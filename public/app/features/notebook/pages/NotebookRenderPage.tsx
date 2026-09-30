import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { NotebookPdfLayout } from '../scene/NotebookPdfLayout';
import { type NotebookScene } from '../scene/NotebookScene';

import { getNotebookPageStateManager } from './NotebookPageStateManager';
import { reportRenderFailed } from './notebookRenderReadiness';

/**
 * The page the headless browser behind "Export as PDF" loads (see export/openNotebookPdf).
 *
 * Its own `chromeless` route rather than the notebook page in a special mode, so there is no app
 * chrome, page shell, toolbar or controls row to undo from the outside.
 */
export function NotebookRenderPage() {
  // The route table is not a React component and cannot read the flag.
  const notebooksEnabled = useFlagDashboardNotebooks();

  const { uid } = useParams();
  const stateManager = getNotebookPageStateManager();
  const { scene, loadError } = stateManager.useState();

  useEffect(() => {
    if (notebooksEnabled && uid) {
      stateManager.loadNotebook(uid);
    }

    return () => {
      stateManager.clearState();
      // Evicted, not just cleared: the cache outlives a route change, and this page latches
      // autosave off on the scene it renders, so a later in-app visit would reuse a notebook that
      // can never save again.
      if (uid) {
        stateManager.removeSceneCache(uid);
      }
    };
  }, [stateManager, uid, notebooksEnabled]);

  // Above the early returns below, so hook order never varies. Only the failure is reported: a
  // successful capture is detected by the renderer polling for the page to settle. Under the
  // `reportRenderBinding` toggle it waits for a message instead and never falls back to polling, so
  // a successful export waits out its timeout — fixing that means waiting for every panel's queries
  // to go idle, since the renderer ends its wait on any call to the binding without reading it.
  useEffect(() => {
    if (loadError) {
      reportRenderFailed();
    }
  }, [loadError]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  // Shown rather than swallowed: the renderer captures the page either way, so a blank one becomes
  // a blank PDF. An error on the sheet is at least diagnosable.
  if (loadError) {
    return (
      <Alert title={t('notebook.errors.failed-to-load', 'Failed to load notebook')} severity="error">
        {loadError.message}
      </Alert>
    );
  }

  // No spinner: the renderer captures whatever is on the page, so it would become the PDF.
  if (!scene) {
    return null;
  }

  // For the time range: the render url carries from/to/timezone, which SceneTimeRange only picks up
  // through the sync manager.
  return (
    <UrlSyncContextProvider scene={scene} updateUrlOnInit={true} createBrowserHistorySteps={false}>
      <NotebookPdfLayout />
      <NotebookRenderDocument scene={scene} />
    </UrlSyncContextProvider>
  );
}

function NotebookRenderDocument({ scene }: { scene: NotebookScene }) {
  useEffect(() => {
    const deactivate = scene.activate();
    // This tab photographs the notebook, so it must not write to it or re-query underneath itself.
    // `abandon` is one-way, which is why the page evicts this scene from the cache on unmount.
    scene.autosave.abandon();
    scene.state.refreshPicker.setState({ refresh: '' });

    return deactivate;
  }, [scene]);

  return <scene.Component model={scene} />;
}

export default NotebookRenderPage;
