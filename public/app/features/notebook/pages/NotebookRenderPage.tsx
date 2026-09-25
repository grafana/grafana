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
 * A notebook drawn to be captured rather than read — the page the headless browser behind
 * "Export as PDF" loads (see export/openNotebookPdf).
 *
 * Its own route, rather than the ordinary notebook page in a special mode, because everything that
 * makes that page good on screen is wrong on paper: Grafana's app chrome, the page shell's rounded
 * card, the toolbar, the controls row. Reaching in to undo all of that from the outside meant a
 * stylesheet of `!important` overrides coupled to other components' internals. Here there is
 * nothing to undo — the route is registered `chromeless`, and this component simply never renders
 * the parts a document does not want.
 *
 * Deliberately thin: it shares NotebookPageStateManager with the notebook page, so loading, the
 * scene cache and error handling behave identically, and it renders the same scene component. Only
 * the shell differs.
 */
export function NotebookRenderPage() {
  // Enforced here rather than on the route, for the same reason NotebookScenePage does it: the route
  // table is not a React component and cannot read the flag.
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
    };
  }, [stateManager, uid, notebooksEnabled]);

  // Reported so the renderer is not left waiting on a page that has already failed. Above the
  // returns below because hooks run in the same order every render.
  //
  // Only the failure. A successful capture is detected by the renderer polling for the page to
  // settle, which needs nothing from us. Under the `reportRenderBinding` toggle (experimental, off
  // by default) the renderer waits for a message instead and never falls back to polling, so a
  // successful notebook export waits out its readiness timeout — worth fixing if that toggle heads
  // for GA.
  //
  // That fix has to wait for every panel's queries to go idle rather than fire on mount, because
  // the renderer ends its wait on any call to the binding without reading the message at all: a
  // signal sent early would have it capture a half-drawn notebook and report that as a success.
  // The same indifference is why reporting a failure works — it ends the wait, and the payload
  // saying the render failed is discarded.
  useEffect(() => {
    if (loadError) {
      reportRenderFailed();
    }
  }, [loadError]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  // Shown rather than swallowed: the renderer captures the page either way — by polling, or, with
  // the toggle above on, because the failure reported there ended its wait — so a page left blank
  // is captured as a blank PDF. An error on the sheet is at least diagnosable, and is what the
  // dashboard report page does too. No Page shell — this route has none by design.
  if (loadError) {
    return (
      <Alert title={t('notebook.errors.failed-to-load', 'Failed to load notebook')} severity="error">
        {loadError.message}
      </Alert>
    );
  }

  // No spinner, deliberately: the renderer captures whatever is on the page once it settles, so a
  // loading state would simply become the PDF.
  if (!scene) {
    return null;
  }

  // Mounted for the time range: the render url carries from/to/timezone, and SceneTimeRange only
  // picks those up through the sync manager. Without this the capture would silently use the
  // notebook's saved range instead of the one being exported.
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
    // This tab exists to photograph the notebook, never to change it. Autosave would otherwise be
    // watching — harmless in practice, since a capture makes no edits, but a render that can write
    // to the document it is rendering is not a property worth relying on.
    scene.autosave.abandon();
    // Same statement, about refreshing: a capture is a still photograph, so nothing should be
    // re-querying underneath it while the renderer works. Stated outright rather than left to fall
    // out of nobody rendering the refresh picker, which is what used to suppress it by accident.
    scene.state.refreshPicker.setState({ refresh: '' });

    return deactivate;
  }, [scene]);

  return <scene.Component model={scene} />;
}

export default NotebookRenderPage;
