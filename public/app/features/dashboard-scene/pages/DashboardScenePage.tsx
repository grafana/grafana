import { useEffect, useLayoutEffect, useRef } from 'react';
import { Params, useParams } from 'react-router-dom-v5-compat';
import { usePrevious } from 'react-use';

import { PageLayoutType } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { DashboardRoutes } from 'app/types';

import { DashboardPrompt } from '../saving/DashboardPrompt';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

export interface Props
  extends Omit<GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>, 'match'> {}

export function DashboardScenePage({ route, queryParams, location }: Props) {
  const params = useParams();
  const { type, slug, uid } = params;
  const prevMatch = usePrevious({ params });
  const stateManager = config.featureToggles.useV2DashboardsAPI
    ? getDashboardScenePageStateManager('v2')
    : getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();
  // After scene migration is complete and we get rid of old dashboard we should refactor dashboardWatcher so this route reload is not need
  const routeReloadCounter = (location.state as any)?.routeReloadCounter;
  const prevParams = useRef<Params<string>>(params);

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Normal && type === 'snapshot') {
      stateManager.loadSnapshot(slug!);
    } else {
      stateManager.loadDashboard({
        type,
        slug,
        uid: uid ?? '',
        route: route.routeName as DashboardRoutes,
        urlFolderUid: queryParams.folderUid,
      });
    }

    return () => {
      stateManager.clearState();
    };

    // removing slug from dependencies to prevent unmount when data links reference
    //  the same dashboard with no slug in url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateManager, uid, route.routeName, queryParams.folderUid, routeReloadCounter, type]);

  useLayoutEffect(() => {
    // This use effect corrects URL without refresh when navigating to the same dashboard
    //  using data link that has no slug in url
    if (route.routeName === DashboardRoutes.Normal) {
      // correct URL only when there are no new slug
      // if slug is defined and incorrect it will be corrected in stateManager
      if (uid === prevParams.current.uid && prevParams.current.slug && !slug) {
        const currentUrl = locationService.getLocation().pathname;
        const correctedUrl = `${currentUrl.split(uid!)[0]}${uid}/${prevParams.current.slug}`;
        locationService.replace({
          ...locationService.getLocation(),
          pathname: correctedUrl,
        });
      }
    }

    return () => {
      prevParams.current = { uid, slug: !slug ? prevParams.current.slug : slug };
    };
  }, [route, slug, type, uid]);

  if (!dashboard) {
    let errorElement;
    if (loadError) {
      errorElement = <DashboardPageError error={loadError} type={type} />;
    }

    return (
      errorElement || (
        <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} data-testid={'dashboard-scene-page'}>
          <Box paddingY={4} display="flex" direction="column" alignItems="center">
            {isLoading && <PageLoader />}
          </Box>
        </Page>
      )
    );
  }

  // Do not render anything when transitioning from one dashboard to another
  // A bit tricky for transition to or from Home dashboard that does not have a uid in the url (but could have it in the dashboard model)
  // if prevMatch is undefined we are going from normal route to home route or vice versa
  if (type !== 'snapshot' && (!prevMatch || uid !== prevMatch?.params.uid)) {
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
