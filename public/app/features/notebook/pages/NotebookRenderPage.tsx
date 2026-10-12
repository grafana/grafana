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
      if (uid) {
        stateManager.removeSceneCache(uid);
      }
    };
  }, [stateManager, uid, notebooksEnabled]);

  useEffect(() => {
    if (loadError) {
      reportRenderFailed();
    }
  }, [loadError]);

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
    // The sheet has no time picker, so the header has to say which range the panels show.
    scene.state.body.setState({ showTimeRange: true });

    return deactivate;
  }, [scene]);

  return <scene.Component model={scene} />;
}

/**
 * Tells grafana-image-renderer a capture has ended, over the chromedp binding it injects — a no-op
 * unless the `reportRenderBinding` toggle made Grafana advertise support for it.
 *
 * The renderer only notices that a message arrived, never reads it, so this amounts to "stop
 * waiting": useful for a failure, and worse than nothing if sent early. Duplicated from
 * dashboard/services/ReportRenderReadinessObserver, whose own sender is module-private.
 */
function reportRenderFailed(): void {
  window.__grafanaImageRendererMessageChannel?.(
    JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: false } })
  );
}

export default NotebookRenderPage;
