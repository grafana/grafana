import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { type NotebookScene } from '../scene/NotebookScene';
import { NotebookToolbar } from '../toolbar/NotebookToolbar';

import { NotebookPageError } from './NotebookPageError';
import { getNotebookPageStateManager } from './NotebookPageStateManager';

// Fetch a notebook, build its composed NotebookScene, and render it. The page owns the chrome
// (breadcrumb, loading/error states); the scene owns time controls, cells and overlays.
export function NotebookScenePage() {
  // The route is registered unconditionally (getAppRoutes is not a React component), so the
  // feature flag is enforced here via the OpenFeature hook. When it is off the notebook page
  // is not a real route, so we render the standard not-found page.
  const notebooksEnabled = useFlagDashboardNotebooks();

  const { uid } = useParams();
  const stateManager = getNotebookPageStateManager();
  const { scene, isLoading, loadError } = stateManager.useState();

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

  if (!scene) {
    return loadError ? (
      <NotebookPageError error={loadError} />
    ) : (
      <Page navId="notebooks" layout={PageLayoutType.Canvas} data-testid="notebook-scene-page">
        <Box paddingY={4} display="flex" direction="column" alignItems="center">
          {isLoading && <PageLoader />}
        </Box>
      </Page>
    );
  }

  // Mounted for every notebook, including one with the time picker hidden: the scene syncs its edit
  // mode through NotebookSceneUrlSync, so skipping this would leave ?edit=true ignored and the
  // toggle unable to write the url. SceneTimeRange (from/to/timezone) and SceneRefreshPicker
  // (refresh) sync their own keys alongside it; the notebook has no dashboard chrome keys
  // (editPanel, editview, shareView) at all.
  return (
    <UrlSyncContextProvider scene={scene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <NotebookDocument scene={scene} />
    </UrlSyncContextProvider>
  );
}

function NotebookDocument({ scene }: { scene: NotebookScene }) {
  // uid comes off the scene rather than the route param: it is the notebook's identity
  // (metadata.name), and the scene already carries it for the same reason it carries the title.
  const { title, uid } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // The Notebooks nav section supplies the parent breadcrumb, so pageNav only carries the title.
  const pageNav = { text: title };

  return (
    <Page navId="notebooks" pageNav={pageNav} layout={PageLayoutType.Custom}>
      {uid && <NotebookToolbar uid={uid} />}
      <scene.Component model={scene} />
    </Page>
  );
}

export default NotebookScenePage;
