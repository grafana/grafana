import { customAlphabet } from 'nanoid';

import { t } from '@grafana/i18n';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { getMessageFromError, getMessageIdFromError, getStatusFromError } from 'app/core/utils/errors';
import { type Resource } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { notebookResourceFor } from '../api/notebookResource';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

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
 * Names a new notebook something you can tell apart from the last one, because autosave creates them
 * without asking for a name and a library of identical titles is unreadable.
 *
 * The token is invented here and is not the notebook's uid. It cannot be: the title is part of the
 * spec that creates the notebook, and the apiserver does not pick a name until it has created it.
 * Alphabet and length copied from the provisioning drawer, which already needed a short readable one.
 */
const generateTitleToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

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
export class NotebookPageStateManager extends StateManagerBase<NotebookPageState> {
  private cache = new Map<string, { generation?: number; scene: NotebookScene }>();

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

  public async loadNotebook(uid: string): Promise<void> {
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

      // The generated client type mirrors the apiserver Resource<NotebookSpec> at runtime (same
      // OpenAPI source); bridge at the fetch seam so everything downstream uses the schema types.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema resource type at the fetch seam
      const notebook = result.data as unknown as Resource<NotebookSpec>;

      const cached = this.cache.get(uid);
      // The generation this was loaded at goes stale the moment the page saves, because autosave advances
      // the server's copy without reloading. Where the scene has saved since, that is the newer number, and
      // it is what separates this page's own write from somebody else's.
      const cachedGeneration = cached ? (cached.scene.autosave.state.savedGeneration ?? cached.generation) : undefined;
      if (cached && isAtLeastAsNew(cachedGeneration, notebook.metadata.generation)) {
        if (this.isSuperseded(seq)) {
          return;
        }
        this.setState({ scene: cached.scene, isLoading: false });
        return;
      }

      // RTK Query freezes cached responses (Immer). The scene pipeline mutates nested panel
      // fieldConfig (e.g. threshold base → -Infinity), so clone before transforming.
      const scene = transformNotebookToScene(structuredClone(notebook));

      // Cache even when superseded: the work is already paid for, so a later visit to this uid can
      // reuse it. Only the state write has to be suppressed.
      this.cache.set(uid, { generation: notebook.metadata.generation, scene });

      if (this.isSuperseded(seq)) {
        return;
      }
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
  public newNotebook(): void {
    // A load already in flight would otherwise resolve on top of this and replace the blank notebook
    // with whichever one the page was previously asked for.
    this.requestSeq++;

    const spec: NotebookSpec = {
      ...defaultNotebookSpec(),
      title: t('notebooks.new.default-title', 'Notebook #{{token}}', { token: generateTitleToken() }),
    };

    // Held so the page can keep this exact scene once its first save gives it a uid.
    this.unsavedScene = transformNotebookToScene(notebookResourceFor(undefined, spec));

    this.setState({ scene: this.unsavedScene, isLoading: false, loadError: undefined });
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
    this.cache.set(uid, { generation: scene.autosave.state.savedGeneration, scene });
    this.setState({ scene, isLoading: false, loadError: undefined });

    return true;
  }

  /** Whether a newer load (or a page teardown) has taken over since the given one started. */
  private isSuperseded(seq: number): boolean {
    return seq !== this.requestSeq;
  }

  public clearState(): void {
    // Bumping the counter discards anything in flight: without it a load that resolves after the page
    // is gone repopulates the singleton, and the next notebook opened flashes the previous one first.
    this.requestSeq++;
    this.setState({ scene: undefined, isLoading: false, loadError: undefined });
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
