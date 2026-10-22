import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { NotebookPdfLayout } from '../scene/NotebookPdfLayout';
import { type NotebookScene } from '../scene/NotebookScene';

import { getNotebookPageStateManager } from './NotebookPageStateManager';
import { createRenderCompleteReporter, watchRenderReadiness } from './notebookRenderReadiness';

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
  const [reportRenderComplete] = useState(() => createRenderCompleteReporter());

  useEffect(() => {
    if (notebooksEnabled && uid) {
      stateManager.loadNotebook(uid);
    }

    return () => {
      stateManager.clearState();
      if (uid) {
        stateManager.removeSceneCache(uid);
      }
    };
  }, [stateManager, uid, notebooksEnabled]);

  useEffect(() => {
    if (loadError) {
      reportRenderComplete(false);
    }
  }, [loadError, reportRenderComplete]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

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
      <NotebookRenderDocument scene={scene} reportRenderComplete={reportRenderComplete} />
    </UrlSyncContextProvider>
  );
}

interface NotebookRenderDocumentProps {
  scene: NotebookScene;
  reportRenderComplete: (success: boolean) => void;
}

function NotebookRenderDocument({ scene, reportRenderComplete }: NotebookRenderDocumentProps) {
  useEffect(() => {
    const deactivate = scene.activate();
    // This tab photographs the notebook, so it must not write to it or re-query underneath itself.
    // `abandon` is one-way, which is why the page evicts this scene from the cache on unmount.
    scene.autosave.abandon();
    scene.state.refreshPicker.setState({ refresh: '' });
    // The sheet has no time picker, so the header has to say which range the panels show.
    scene.state.body.setState({ showTimeRange: true });
    const stopWatching = watchRenderReadiness(scene, () => reportRenderComplete(true));

    return () => {
      stopWatching();
      deactivate();
    };
  }, [scene, reportRenderComplete]);

  return <scene.Component model={scene} />;
}

export default NotebookRenderPage;
