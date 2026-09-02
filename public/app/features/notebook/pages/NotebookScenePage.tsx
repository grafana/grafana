import { useEffect } from 'react';
import { useMatch, useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';

import { type NotebookScene } from '../scene/NotebookScene';
import { NotebookToolbar } from '../toolbar/NotebookToolbar';
import { NOTEBOOK_NEW_URL, notebookViewUrl } from '../urls';

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
  // Both routes render this page, and the blank one has no uid to tell them apart by. Matched against
  // the path rather than read off a route prop, so the page stays driven by the url like its edit mode.
  const isNew = Boolean(useMatch(NOTEBOOK_NEW_URL));
  const stateManager = getNotebookPageStateManager();
  const { scene, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (notebooksEnabled) {
      if (uid) {
        stateManager.loadNotebook(uid);
      } else if (isNew) {
        stateManager.newNotebook();
      }
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid, isNew, notebooksEnabled]);

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
      <NotebookDocument scene={scene} isNew={isNew} />
    </UrlSyncContextProvider>
  );
}

function NotebookDocument({ scene, isNew }: { scene: NotebookScene; isNew: boolean }) {
  // uid comes off the scene rather than the route param: it is the notebook's identity
  // (metadata.name), and the scene already carries it for the same reason it carries the title.
  const { title, uid } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // A blank notebook that has just been created by its first save: point the url at it instead of the
  // route that made it. Replace rather than push, or Back lands back on the blank route and reads as a
  // second empty notebook. Keep the current search params: they hold the scene's own time range, and
  // dropping them would reset the range to nothing.
  useEffect(() => {
    if (isNew && uid) {
      locationService.replace({ pathname: notebookViewUrl(uid), search: locationService.getLocation().search });
    }
  }, [isNew, uid]);

  // The Notebooks nav section supplies the parent breadcrumb, so pageNav only carries the title.
  const pageNav = { text: title };

  return (
    <Page navId="notebooks" pageNav={pageNav} layout={PageLayoutType.Custom}>
      {/* Rendered before the notebook exists too, with its actions disabled. Hiding it until the
          first save produced a uid meant the bar appeared under someone who was already typing and
          pushed the whole document down. The toolbar owns that distinction, not this page. */}
      <NotebookToolbar uid={uid} scene={scene} />
      <scene.Component model={scene} />
    </Page>
  );
}

export default NotebookScenePage;
