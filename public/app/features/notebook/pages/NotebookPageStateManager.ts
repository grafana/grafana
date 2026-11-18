import { type Notebook } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getPanelPluginMetasMap } from '@grafana/runtime/internal';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getMessageFromError, getMessageIdFromError, getStatusFromError } from 'app/core/utils/errors';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { NotebookAnalytics } from '../analytics/main';
import {
  NOTEBOOK_ENTRY_POINT,
  NOTEBOOK_LOAD_SOURCE,
  type NotebookEntryPoint,
  type NotebookLoadSource,
} from '../analytics/types';
import { notebookResourceFor, writeBackWithCellIds } from '../api/notebookResource';
import { canEditNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { NotebookDeletedEvent } from '../scene/events';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

// The generated client type and the schema resource type describe the same object; the spec types come from separate generators.
function toNotebookResource(notebook: Notebook): Resource<NotebookSpec> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- bridge the generated client type to the schema type at the fetch seam
  return notebook as Resource<NotebookSpec>;
}

/**
 * Gives a notebook that predates cell ids its ids by writing it back once as fetched. Comments anchor to
 * the id, so a notebook nobody edits still needs one.
 *
 * Runs before the scene exists, so nothing can be edited under the write. A failure or conflict is
 * ignored: the notebook as fetched is still good, and the next open tries again.
 */
async function withCellIds(
  uid: string,
  fetched: Notebook,
  notebook: Resource<NotebookSpec>
): Promise<Resource<NotebookSpec>> {
  const cells = notebook.spec.layout?.spec?.cells ?? [];
  if (!canEditNotebooks() || cells.every((cell) => cell.spec.id)) {
    return notebook;
  }

  try {
    return toNotebookResource(await writeBackWithCellIds(uid, fetched));
  } catch {
    return notebook;
  }
}

/**
 * A load failure normalized to the fields the error UI needs. RTK rejects with `{ status, data }`
 * rather than an Error, so the raw value must be normalized here — coercing it to an Error would
 * drop the HTTP status (no 404 not-found state) and stringify the body to "[object Object]".
 */
export interface NotebookLoadError {
  status?: number;
  messageId?: string;
  message: string;
}

/**
 * Names a new notebook after the moment it was created, because autosave creates them without asking
 * for a name and a library of identical titles is unreadable.
 *
 * The format is pinned rather than left to the user's date settings so that sorting the list by title
 * still puts these in the order they were made. Minute precision, so two notebooks created in the same
 * minute do share a title — titles are not unique (the uid comes from the apiserver's generateName),
 * and the seconds are noise the rest of the time.
 */
const NEW_TITLE_DATE_FORMAT = 'YYYY-MM-DD HH:mm';

export interface NotebookPageState {
  scene?: NotebookScene;
  isLoading: boolean;
  loadError?: NotebookLoadError;
}

/**
 * Loads a Notebook resource and builds its scene. Deliberately independent of the dashboard page
 * state managers: inheriting DashboardScenePageStateManagerV2 made every notebook open emit
 * dashboard analytics (DashboardView meta-analytics, dashboardInitialized, the dashboard_view
 * query profile) and forced the notebook through the dashboard envelope/transform.
 */
/**
 * Scenes by uid, shared across every manager instance rather than held per instance.
 *
 * A notebook can be on screen more than once — the route plus an embed of the same notebook in a
 * host that is not the route. Each consumer gets its own manager, so its own loading and error
 * state, but they must resolve the SAME scene: a scene owns its autosave, and two scenes for one
 * notebook means two autosaves writing the whole spec over each other, the later one silently
 * undoing edits made through the other. Scene activation is reference counted, so one scene safely
 * serves several consumers and tears down when the last releases it.
 */
const sceneCache = new Map<string, { generation?: number; scene: NotebookScene }>();

export class NotebookPageStateManager extends StateManagerBase<NotebookPageState> {
  /**
   * `embedded` is for a host other than the notebook route, which reports its loads as such. The route's
   * singleton below leaves it off.
   */
  public constructor(
    initialState: NotebookPageState,
    private readonly embedded = false
  ) {
    super(initialState);
  }

  private get cache() {
    return sceneCache;
  }

  // Identifies the load the page currently wants. `await` does not cancel, so a load started for an
  // earlier request still resumes and would write over a newer one — the page renders whatever is in
  // this singleton, with nothing tying that to the route. Navigating A -> B while A is in flight would
  // otherwise leave B's URL showing A, and it would stick, because nothing fires afterwards.
  //
  // A counter rather than the requested uid, so two loads of the *same* notebook are distinguishable
  // too: clearState() followed by a re-request of the same uid would otherwise let the abandoned load
  // through, because its uid matches again. That case is currently unobservable — RTK Query collapses
  // concurrent initiate() calls sharing a cache key into one request, so both loads see the same
  // outcome — but the counter is correct by construction and does not depend on that.
  private requestSeq = 0;

  // The blank notebook that newNotebook() hands out, kept here until it saves itself or gets replaced.
  // It has no uid yet, so the cache above can't hold it. Once its first save creates it, the page moves
  // to the real url. Without this field, that move would fetch the notebook fresh from the server and
  // throw away the scene someone is typing in, along with its caret and undo history.
  private unsavedScene?: NotebookScene;

  /**
   * `source` is where the reader came from, for the `loaded` event. A caller that knows nothing leaves it off.
   *
   * `readOnly` is for a page that only looks at the notebook, such as the PDF render, and never writes.
   */
  public async loadNotebook(
    uid: string,
    source: NotebookLoadSource = NOTEBOOK_LOAD_SOURCE.DIRECT,
    { readOnly = false }: { readOnly?: boolean } = {}
  ): Promise<void> {
    const seq = ++this.requestSeq;

    if (this.adoptUnsavedScene(uid)) {
      return;
    }

    this.setState({ isLoading: true, loadError: undefined });

    try {
      const result = await dispatch(
        dashboardAPIv2beta1.endpoints.getNotebook.initiate({ name: uid }, { subscribe: false })
      );

      if (result && 'error' in result) {
        throw result.error;
      }

      if (!result.data) {
        throw new Error('Notebook not found');
      }

      const notebook = toNotebookResource(result.data);

      // Autosave advances the server's generation without reloading, so a cached scene's own generation goes
      // stale. Prefer the one it last saved at, which tells this page's writes from somebody else's.
      const reuseCachedScene = (generation: number | undefined): boolean => {
        const cached = this.cache.get(uid);
        const cachedGeneration = cached
          ? (cached.scene.autosave.state.savedGeneration ?? cached.generation)
          : undefined;
        if (!cached || !isAtLeastAsNew(cachedGeneration, generation)) {
          return false;
        }
        if (this.isSuperseded(seq)) {
          return true;
        }
        // Here rather than in the scene's own activation or teardown, both of which have the url in the
        // way: `UrlSyncContextProvider` applies the url to the scene before the scene activates, so
        // resetting there would throw away a `?from=&to=` somebody was linked to, and its cleanup runs
        // after the scene's, by which point the router has moved on to the next page.
        cached.scene.autosave.discardViewOnlyTimeChanges();
        NotebookAnalytics.loaded(cached.scene, true, this.embedded, source);
        this.setState({ scene: cached.scene, isLoading: false });
        return true;
      };

      if (reuseCachedScene(notebook.metadata.generation)) {
        return;
      }

      // Panel cells are built synchronously below.
      await getPanelPluginMetasMap();

      // After the cache check, because writing bumps the generation and would stop an edited scene being reused.
      const loaded = readOnly ? notebook : await withCellIds(uid, result.data, notebook);

      // Check again: another manager may have cached a scene while this one awaited, and a second scene
      // would mean two autosaves for one notebook.
      if (reuseCachedScene(loaded.metadata.generation)) {
        return;
      }

      // RTK Query freezes cached responses (Immer). The scene pipeline mutates nested panel
      // fieldConfig (e.g. threshold base → -Infinity), so clone before transforming.
      const scene = transformNotebookToScene(structuredClone(loaded));

      // Cache even when superseded: the work is already paid for, so a later visit to this uid can
      // reuse it. Only the state write has to be suppressed.
      this.cacheScene(uid, loaded.metadata.generation, scene);

      if (this.isSuperseded(seq)) {
        return;
      }
      NotebookAnalytics.loaded(scene, false, this.embedded, source);
      this.setState({ scene, isLoading: false });
    } catch (error) {
      // A superseded failure must not surface either, or a stale 404 would replace the notebook the
      // page has already loaded.
      if (this.isSuperseded(seq)) {
        return;
      }

      this.setState({
        isLoading: false,
        loadError: {
          status: getStatusFromError(error),
          message: getMessageFromError(error),
          messageId: getMessageIdFromError(error),
        },
      });
    }
  }

  /**
   * Builds an empty notebook with no resource behind it, for the blank route.
   *
   * Nothing is fetched and nothing is written: the notebook is created by its first save, which is
   * what leaves `uid` unset here. It is deliberately not cached either, because the cache is keyed by
   * uid and this notebook has none.
   */
  public async newNotebook(source: NotebookEntryPoint = NOTEBOOK_ENTRY_POINT.NOTEBOOK_LIST): Promise<void> {
    // A load already in flight would otherwise resolve on top of this and replace the blank notebook
    // with whichever one the page was previously asked for.
    const seq = ++this.requestSeq;

    this.setState({ isLoading: true, loadError: undefined });

    try {
      // The first visualization block inserted into the blank notebook is built synchronously.
      await getPanelPluginMetasMap();

      if (this.isSuperseded(seq)) {
        return;
      }

      const spec: NotebookSpec = {
        ...defaultNotebookSpec(),
        title: t('notebooks.new.default-title-with-date', 'Notebook {{date}}', {
          date: dateTimeFormat(Date.now(), { format: NEW_TITLE_DATE_FORMAT }),
        }),
      };

      // Held so the page can keep this exact scene once its first save gives it a uid.
      this.unsavedScene = transformNotebookToScene(notebookResourceFor(undefined, spec));
      this.unsavedScene.autosave.setEntryPoint(source);

      this.setState({ scene: this.unsavedScene, isLoading: false, loadError: undefined });
    } catch (error) {
      if (this.isSuperseded(seq)) {
        return;
      }

      this.setState({
        isLoading: false,
        loadError: {
          status: getStatusFromError(error),
          message: getMessageFromError(error),
          messageId: getMessageIdFromError(error),
        },
      });
    }
  }

  /**
   * Takes up the blank notebook once its first save has created it, instead of fetching a notebook we
   * already have on screen.
   *
   * Reads the uid off the scene instead of having autosave report it. If autosave called into the page
   * directly, that would create an import cycle back through `transformNotebookToScene`.
   */
  private adoptUnsavedScene(uid: string): boolean {
    const scene = this.unsavedScene;
    if (scene?.state.uid !== uid) {
      return false;
    }

    this.unsavedScene = undefined;
    // Into the keyed cache, so coming back to this notebook later reuses it too rather than rebuilding
    // it from a fetch. The generation is the one its create returned.
    this.cacheScene(uid, scene.autosave.state.savedGeneration, scene);
    this.setState({ scene, isLoading: false, loadError: undefined });

    return true;
  }

  /** Whether a newer load (or a page teardown) has taken over since the given one started. */
  private isSuperseded(seq: number): boolean {
    return seq !== this.requestSeq;
  }

  /** Caches a scene by uid and wires it to evict itself once deleted. */
  private cacheScene(uid: string, generation: number | undefined, scene: NotebookScene): void {
    this.cache.set(uid, { generation, scene });
    scene.subscribeToEvent(NotebookDeletedEvent, () => this.removeSceneCache(uid));
  }

  public clearState(): void {
    // Bumping the counter discards anything in flight: without it a load that resolves after the page
    // is gone repopulates the singleton, and the next notebook opened flashes the previous one first.
    this.requestSeq++;
    this.setState({ scene: undefined, isLoading: false, loadError: undefined });
  }

  /**
   * @internal -- test seam.
   *
   * Deliberately goes through `this.cache`, the same accessor `loadNotebook` reads, rather than the
   * module map directly: reaching for the module map would make the sharing test pass even if the
   * cache went back to being per instance, which is the regression it exists to catch.
   */
  public setSceneCacheForTests(uid: string, scene: NotebookScene): void {
    this.cacheScene(uid, undefined, scene);
  }

  /** @internal -- test seam, as above. */
  public getCachedSceneForTests(uid: string): NotebookScene | undefined {
    return this.cache.get(uid)?.scene;
  }

  public removeSceneCache(uid: string): void {
    this.cache.delete(uid);
  }

  public clearSceneCache(): void {
    this.cache.clear();
  }
}

/**
 * Deliberately not an equality check. `generation` only ever goes up, and the query layer can answer a load
 * with a response it recorded before this page's own save, which a rebuild would then undo. Only a higher
 * number means somebody else wrote. Falls back to equality when either side is missing.
 */
function isAtLeastAsNew(cached: number | undefined, fetched: number | undefined): boolean {
  if (cached === undefined || fetched === undefined) {
    return cached === fetched;
  }

  return cached >= fetched;
}

let notebookPageStateManager: NotebookPageStateManager | undefined;

// Shared, lazily-created once per app load. A page component should not `new` this on every
// mount: the module-level singleton lets the scene cache survive navigations.
export function getNotebookPageStateManager(): NotebookPageStateManager {
  if (!notebookPageStateManager) {
    notebookPageStateManager = new NotebookPageStateManager({ isLoading: false });
  }

  return notebookPageStateManager;
}
