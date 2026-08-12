import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { type NotebookScene } from '../scene/NotebookScene';
import { NotebookToolbar } from '../toolbar/NotebookToolbar';
import { NOTEBOOK_EDIT_PARAM, NOTEBOOK_EDIT_PARAM_ON } from '../urls';

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
  const [searchParams] = useSearchParams();
  // uid comes off the scene rather than the route param: it is the notebook's identity
  // (metadata.name), and the scene already carries it for the same reason it carries the title.
  const { title, uid } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // The url decides the mode at load, so the list page's Edit action lands straight in edit mode and
  // a reload keeps you there. Both directions are handled because the page state manager caches
  // scenes per uid: revisiting a notebook can hand back one that is still in edit mode from last
  // time, which the url must be able to clear. Guarded so neither branch rewrites the url for a
  // mode the scene is already in.
  const wantsEditing = searchParams.get(NOTEBOOK_EDIT_PARAM) === NOTEBOOK_EDIT_PARAM_ON;
  useEffect(() => {
    if (wantsEditing && !scene.state.isEditing) {
      scene.onEnterEditMode();
    } else if (!wantsEditing && scene.state.isEditing) {
      scene.onExitEditMode();
    }
  }, [scene, wantsEditing]);

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
