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

  // A notebook with the time picker hidden has no time state to reflect in the URL, so skip URL
  // sync entirely (same as the public dashboard page). Otherwise SceneTimeRange (from/to/timezone)
  // and SceneRefreshPicker (refresh) sync their own keys — the notebook has no scene-level URL
  // handler, so no dashboard chrome keys (editPanel, editview, shareView) exist at all.
  if (scene.state.hideTimeControls) {
    return <NotebookDocument scene={scene} />;
  }

  return (
    <UrlSyncContextProvider scene={scene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <NotebookDocument scene={scene} />
    </UrlSyncContextProvider>
  );
}

function NotebookDocument({ scene }: { scene: NotebookScene }) {
  const { title } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // The Notebooks nav section supplies the parent breadcrumb, so pageNav only carries the title.
  const pageNav = { text: title };

  return (
    <Page navId="notebooks" pageNav={pageNav} layout={PageLayoutType.Custom}>
      <scene.Component model={scene} />
    </Page>
  );
}

export default NotebookScenePage;
