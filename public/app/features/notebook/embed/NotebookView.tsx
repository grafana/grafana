import { type ReactNode, useEffect, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { Alert, Box } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { NotebookPageStateManager, type NotebookLoadError } from '../pages/NotebookPageStateManager';
import { type NotebookScene } from '../scene/NotebookScene';

export interface NotebookViewProps {
  /** The notebook to render, by `metadata.name`. */
  uid: string;
  /**
   * The notebook's title, reported as it loads and whenever it is edited, for a host that labels a
   * tab or a header with it. A callback rather than a rendered node: props cross the plugin
   * boundary through `writableProxy`, which passes functions through untouched but deep-clones
   * everything else.
   */
  onTitleChange?: (title: string) => void;
}

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
export function NotebookView({ uid, onTitleChange }: NotebookViewProps) {
  const notebooksEnabled = useFlagDashboardNotebooks();

  // Per instance, not the module singleton: the singleton holds one scene for the whole app, so an
  // embedded notebook would evict whatever the notebooks route had open and be evicted by it in
  // turn. The cost is that this instance's scene is not shared with the route's.
  const stateManager = useMemo(() => new NotebookPageStateManager({ isLoading: false }), []);
  const { scene, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (!notebooksEnabled) {
      return;
    }

    stateManager.loadNotebook(uid);

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid, notebooksEnabled]);

  if (!notebooksEnabled) {
    return null;
  }

  if (!scene) {
    return loadError ? <NotebookViewError error={loadError} /> : <Centered>{isLoading && <PageLoader />}</Centered>;
  }

  return <NotebookDocument scene={scene} onTitleChange={onTitleChange} />;
}

function NotebookDocument({ scene, onTitleChange }: { scene: NotebookScene; onTitleChange?: (title: string) => void }) {
  const { title } = scene.useState();

  useEffect(() => {
    // Set before activation so the first paint already has the right sticky offset, rather than the
    // controls row jumping once this lands.
    scene.setState({ embedded: true });
    return scene.activate();
  }, [scene]);

  useEffect(() => {
    onTitleChange?.(title);
  }, [onTitleChange, title]);

  return <scene.Component model={scene} />;
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
