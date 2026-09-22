import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { NotebookPdfLayout } from '../scene/NotebookPdfLayout';
import { type NotebookScene } from '../scene/NotebookScene';

import { getNotebookPageStateManager } from './NotebookPageStateManager';

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
  const { scene } = stateManager.useState();

  useEffect(() => {
    if (notebooksEnabled && uid) {
      stateManager.loadNotebook(uid);
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid, notebooksEnabled]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  // No loader and no error page: nothing here is for a reader. The renderer waits for the page to
  // settle and captures whatever is on it, so a spinner would simply become the PDF — better to
  // render nothing and let the render time out than to hand back a picture of a loading state.
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
