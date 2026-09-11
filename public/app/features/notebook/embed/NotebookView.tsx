import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { Alert, Box } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { notebookResourceFor } from '../api/notebookResource';
import { NotebookPageStateManager, type NotebookLoadError } from '../pages/NotebookPageStateManager';
import { NotebookEmbeddedHost } from '../scene/NotebookEmbeddedContext';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';
import { type Spec as NotebookSpec } from '../types';

/**
 * How long editing has to pause before a draft reports itself. Matches the debounce a saved
 * notebook's own autosave uses, so the two feel the same to type in.
 *
 * This only paces the reporting. Whether each report is persisted is the host's decision — the
 * assistant coalesces them into one snapshot per editing session rather than one per pause.
 */
const DRAFT_REPORT_DEBOUNCE_MS = 2000;

interface CommonProps {
  /**
   * The notebook's title, reported as it loads and whenever it is edited, for a host that labels a
   * tab or a header with it. A callback rather than a rendered node: props cross the plugin
   * boundary through `writableProxy`, which passes functions through untouched but deep-clones
   * everything else.
   */
  onTitleChange?: (title: string) => void;
}

/** A notebook that exists. Its autosave writes edits straight through to the resource. */
export interface SavedNotebookViewProps extends CommonProps {
  /** The notebook to render, by `metadata.name`. */
  uid: string;
  spec?: never;
  onChange?: never;
}

/**
 * A notebook with no resource behind it: the host holds the document and decides if it is ever
 * saved.
 *
 * Nothing here writes to the API — not on edit, not on unmount. Every edited document is handed
 * back through `onChange` and the host owns persisting it, so a draft can be edited for as long as
 * its host likes without a Notebook appearing in anyone's list.
 */
export interface DraftNotebookViewProps extends CommonProps {
  uid?: never;
  /** The document to edit. Read once, as the starting point — see the note in DraftNotebookView. */
  spec: NotebookSpec;
  /**
   * The edited document, debounced, and flushed once on unmount so closing a tab keeps the last
   * thing typed into it. Without this the draft is editable but nothing survives the component.
   */
  onChange?: (spec: NotebookSpec) => void;
  /** Reports pending edits immediately, before the debounced document callback. False means reported, not saved. */
  onDirtyChange?: (dirty: boolean) => void;
}

export type NotebookViewProps = SavedNotebookViewProps | DraftNotebookViewProps;

/**
 * EXPOSED COMPONENT (stable): `grafana/notebook-view/v1`
 *
 * A notebook rendered on its own, for a host that is not the notebooks route — the Grafana
 * Assistant renders one of these in a canvas tab. Fully editable: the scene brings its own edit
 * toggle, save status, undo/redo and time controls, and its autosave persists through the same
 * endpoints the route uses, so a notebook edited here is the same notebook listed under
 * /notebooks.
 *
 * Takes a uid rather than a document, and deliberately so — this renders a notebook that EXISTS.
 * A host holding a draft has nothing to pass here and nothing to gain: core's editor writes
 * through to the resource on every edit, so pointing it at an unsaved document would either
 * create that resource behind the host's back or drop the edits on the floor. A draft is the
 * host's to render read-only until someone chooses to create it.
 *
 * This component is exposed to plugins via the Plugin Extensions system. Treat its props and
 * user-visible behavior as a stable contract; to change either in a breaking way, expose a new
 * versioned component (v2) rather than editing this one.
 */
export function NotebookView(props: NotebookViewProps) {
  const notebooksEnabled = useFlagDashboardNotebooks();

  if (!notebooksEnabled) {
    return null;
  }

  return props.uid !== undefined ? (
    <SavedNotebookView uid={props.uid} onTitleChange={props.onTitleChange} />
  ) : (
    <DraftNotebookView
      spec={props.spec}
      onChange={props.onChange}
      onDirtyChange={props.onDirtyChange}
      onTitleChange={props.onTitleChange}
    />
  );
}

function SavedNotebookView({ uid, onTitleChange }: SavedNotebookViewProps) {
  // Per instance, not the module singleton: the singleton holds one scene for the whole app, so an
  // embedded notebook would evict whatever the notebooks route had open and be evicted by it in
  // turn. The cost is that this instance's scene is not shared with the route's.
  const stateManager = useMemo(() => new NotebookPageStateManager({ isLoading: false }), []);
  const { scene, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadNotebook(uid);

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid]);

  if (!scene) {
    return loadError ? <NotebookViewError error={loadError} /> : <Centered>{isLoading && <PageLoader />}</Centered>;
  }

  return <NotebookDocument scene={scene} onTitleChange={onTitleChange} />;
}

function DraftNotebookView({ spec, onChange, onDirtyChange, onTitleChange }: DraftNotebookViewProps) {
  /**
   * Built once, from the first spec. The prop is the document's starting point, not a live mirror of
   * it: rebuilding whenever the host echoed an edited spec back would throw away the caret, the undo
   * history and any cell mid-edit — on every report, since this component is what produced that spec.
   */
  const scene = useMemo(() => {
    const built = transformNotebookToScene(notebookResourceFor(undefined, spec));
    // Set before anything activates it: `isDraft` is what stops the autosave from starting and
    // creating a real notebook out from under the host on the first edit.
    built.setState({ isDraft: true });
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately built from the first spec only; see above
  }, []);

  useNotebookDraftChanges(scene, onChange, onDirtyChange);

  return <NotebookDocument scene={scene} onTitleChange={onTitleChange} />;
}

/**
 * Reports the edited document to the host, debounced, with the trailing edit flushed on unmount.
 *
 * Debounced rather than per change because a scene emits state changes continuously while someone
 * types, and each report costs the host a serialization. It is deliberately not throttled down
 * further here: the host knows when an editing session ended and can coalesce, and it cannot
 * recover an edit this never reported.
 */
function useNotebookDraftChanges(
  scene: NotebookScene,
  onChange?: (spec: NotebookSpec) => void,
  onDirtyChange?: (dirty: boolean) => void
) {
  // Held in a ref so a host passing a new callback each render does not restart the subscription and
  // drop a pending edit with it.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    if (!onChange) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    const report = () => {
      timer = undefined;
      pending = false;
      onDirtyChangeRef.current?.(false);
      onChangeRef.current?.(transformNotebookSceneToSaveModel(scene));
    };

    const subscription = scene.subscribeToState(() => {
      pending = true;
      onDirtyChangeRef.current?.(true);
      clearTimeout(timer);
      timer = setTimeout(report, DRAFT_REPORT_DEBOUNCE_MS);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      if (pending) {
        report();
      }
    };
    // `onChange` only gates whether we subscribe; the ref carries the current one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, Boolean(onChange)]);
}

function NotebookDocument({ scene, onTitleChange }: { scene: NotebookScene; onTitleChange?: (title: string) => void }) {
  const { title } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  useEffect(() => {
    onTitleChange?.(title);
  }, [onTitleChange, title]);

  /**
   * Wrapped rather than flagged on the scene: this tree has no app header, but the same scene may
   * also be mounted on /notebooks, which does, and the two share one object so they share one
   * autosave. Only the tree can answer per mount.
   */
  return (
    <NotebookEmbeddedHost>
      <scene.Component model={scene} />
    </NotebookEmbeddedHost>
  );
}

/**
 * The same two failures the route distinguishes, without its Page chrome: a notebook that is not
 * there reads differently from one we could not fetch, and a host showing this in a tab has no
 * breadcrumb to carry that distinction for us.
 */
function NotebookViewError({ error }: { error: NotebookLoadError }) {
  return (
    <Centered>
      {error.status === 404 ? (
        <EntityNotFound entity={t('notebook.errors.entity', 'Notebook')} />
      ) : (
        <Alert
          title={t('notebook.errors.failed-to-load', 'Failed to load notebook')}
          severity="error"
          data-testid="notebook-view-error"
        >
          {error.message}
        </Alert>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <Box paddingY={4} display="flex" direction="column" alignItems="center">
      {children}
    </Box>
  );
}
