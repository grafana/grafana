// Libraries
import { useEffect, useMemo } from 'react';
import { usePrevious } from 'react-use';

import { PageLayoutType } from '@grafana/data';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import store from 'app/core/store';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DASHBOARD_FROM_LS_KEY } from 'app/features/dashboard/state/initDashboard';
import { DashboardDTO, DashboardRoutes } from 'app/types';

import { DashboardPrompt } from '../saving/DashboardPrompt';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props extends GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams> {}

export function DashboardScenePage({ match, route, queryParams, history }: Props) {
  const prevMatch = usePrevious(match);
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();

  // After scene migration is complete and we get rid of old dashboard we should refactor dashboardWatcher so this route reload is not need
  const routeReloadCounter = (history.location.state as any)?.routeReloadCounter;

  // Check if the user is coming from Explore, it's indicated byt the dashboard existence in local storage
  const comingFromExplore = useMemo(() => {
    return Boolean(store.getObject<DashboardDTO>(DASHBOARD_FROM_LS_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.params.uid, match.params.slug, match.params.type]);

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Normal && match.params.type === 'snapshot') {
      stateManager.loadSnapshot(match.params.slug!);
    } else {
      stateManager.loadDashboard({
        uid: match.params.uid ?? '',
        route: route.routeName as DashboardRoutes,
        urlFolderUid: queryParams.folderUid,
        keepDashboardFromExploreInLocalStorage: false,
      });
    }

    return () => {
      stateManager.clearState();
    };
  }, [
    stateManager,
    match.params.uid,
    route.routeName,
    queryParams.folderUid,
    routeReloadCounter,
    match.params.slug,
    match.params.type,
  ]);

  // Effect that handles explore->dashboards workflow
  useEffect(() => {
    // When coming from explore and adding to an existing dashboard, we should enter edit mode
    if (dashboard && comingFromExplore) {
      if (route.routeName !== DashboardRoutes.New) {
        dashboard.onEnterEditMode(comingFromExplore);
      }
    }
  }, [dashboard, comingFromExplore, route.routeName]);

  if (!dashboard) {
    return (
      <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} data-testid={'dashboard-scene-page'}>
        <Box paddingY={4} display="flex" direction="column" alignItems="center">
          {isLoading && <PageLoader />}
          {loadError && (
            <Alert title="Dashboard failed to load" severity="error" data-testid="dashboard-not-found">
              {loadError}
            </Alert>
          )}
        </Box>
      </Page>
    );
  }

  // Do not render anything when transitioning from one dashboard to another
  // A bit tricky for transition to or from Home dashbord that does not have a uid in the url (but could have it in the dashboard model)
  // if prevMatch is undefined we are going from normal route to home route or vice versa
  if (match.params.type !== 'snapshot' && (!prevMatch || match.params.uid !== prevMatch?.params.uid)) {
    console.log('skipping rendering');
    return null;
  }

  return (
    <UrlSyncContextProvider scene={dashboard} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <dashboard.Component model={dashboard} key={dashboard.state.key} />
      <DashboardPrompt dashboard={dashboard} />
    </UrlSyncContextProvider>
  );
}

export default DashboardScenePage;
