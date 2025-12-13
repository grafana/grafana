import { useEffect, useRef } from 'react';
import { Params, useParams } from 'react-router-dom-v5-compat';
import { usePrevious } from 'react-use';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { PublicDashboardFooter } from 'app/features/dashboard/components/PublicDashboard/PublicDashboardsFooter';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { getDashboardSceneProfiler } from 'app/features/dashboard/services/DashboardProfiler';
import { DashboardPreviewBanner } from 'app/features/provisioning/components/Dashboards/DashboardPreviewBanner';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardConversionWarningBanner } from '../components/DashboardConversionWarningBanner';
import { DashboardPrompt } from '../saving/DashboardPrompt';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';

import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';

const KIOSK_DASHBOARD_FOOTER_URL = 'https://grafana.com/?src=grafananet&cnt=kiosk-dashboard';

function shouldHideDashboardKioskFooter(hideLogo?: string | true): boolean {
  if (hideLogo === undefined || hideLogo === null) {
    return false;
  }

  if (hideLogo === true || hideLogo === '1') {
    return true;
  }

  const normalized = String(hideLogo).trim().toLowerCase();
  if (normalized === '') {
    return true;
  }

  return normalized !== 'false' && normalized !== '0';
}

export interface Props
  extends Omit<GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>, 'match'> {}

export function DashboardScenePage({ route, queryParams, location }: Props) {
  const params = useParams();
  const { type, slug, uid } = params;
  // User by /admin/provisioning/:slug/dashboard/preview/* to load dashboards based on their file path in a remote repository
  const path = params['*'];
  const prevMatch = usePrevious({ params });
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, isLoading, loadError } = stateManager.useState();
  // After scene migration is complete and we get rid of old dashboard we should refactor dashboardWatcher so this route reload is not need
  const routeReloadCounter = (() => {
    const state = location.state;
    if (state && typeof state === 'object') {
      const value = Reflect.get(state, 'routeReloadCounter');
      return typeof value === 'number' ? value : undefined;
    }

    return undefined;
  })();

  const dashboardRoute = (() => {
    switch (route.routeName) {
      case DashboardRoutes.Home:
      case DashboardRoutes.New:
      case DashboardRoutes.Template:
      case DashboardRoutes.Normal:
      case DashboardRoutes.Provisioning:
      case DashboardRoutes.Scripted:
      case DashboardRoutes.Public:
      case DashboardRoutes.Embedded:
      case DashboardRoutes.Report:
        return route.routeName;
      default:
        return DashboardRoutes.Normal;
    }
  })();
  const prevParams = useRef<Params<string>>(params);

  useEffect(() => {
    if (route.routeName === DashboardRoutes.Normal && type === 'snapshot') {
      stateManager.loadSnapshot(slug!);
    } else {
      stateManager.loadDashboard({
        uid: (route.routeName === DashboardRoutes.Provisioning ? path : uid) ?? '',
        type,
        slug,
        route: dashboardRoute,
        urlFolderUid: queryParams.folderUid,
      });
    }

    return () => {
      getDashboardSceneProfiler().cancelProfile();
      preserveDashboardSceneStateInLocalStorage(locationService.getSearch(), uid);
      stateManager.clearState();
      stateManager.resetActiveManager();
    };

    // removing slug and path (which has slug in it) from dependencies to prevent unmount when data links reference
    //  the same dashboard with no slug in url
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateManager, uid, route.routeName, queryParams.folderUid, routeReloadCounter, type]);

  useEffect(() => {
    // This use effect corrects URL without refresh when navigating to the same dashboard
    //  using data link that has no slug in url
    if (route.routeName === DashboardRoutes.Normal) {
      // correct URL only when there are no new slug
      // if slug is defined and incorrect it will be corrected in stateManager
      if (uid === prevParams.current.uid && prevParams.current.slug && !slug) {
        const correctedUrl = `/d/${uid}/${prevParams.current.slug}`;
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

  const showKioskFooter = queryParams.kiosk === '1' || queryParams.kiosk === true;
  const hideKioskFooter = shouldHideDashboardKioskFooter(queryParams.hideLogo);

  return (
    <UrlSyncContextProvider scene={dashboard} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <DashboardPreviewBanner queryParams={queryParams} route={route.routeName} slug={slug} path={path} />
      <DashboardConversionWarningBanner dashboard={dashboard} />
      <dashboard.Component model={dashboard} key={dashboard.state.key} />
      <DashboardPrompt dashboard={dashboard} />
      {showKioskFooter && !hideKioskFooter && (
        <PublicDashboardFooter paddingX={2} useMinHeight linkUrl={KIOSK_DASHBOARD_FOOTER_URL} />
      )}
    </UrlSyncContextProvider>
  );
}

export default DashboardScenePage;
