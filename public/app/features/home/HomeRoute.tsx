import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { PageLoader } from '@grafana/ui';
import { SETUP_GUIDE_HOME_URL } from 'app/core/hooks/useHomeNav';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

function HomeRouteInner(props: DashboardPageProxyProps) {
  const flagOn = useFlagGrafanaUnifiedHomepage({ suspend: true });
  return flagOn ? <UnifiedHomeRoute {...props} /> : <DashboardPageProxy {...props} />;
}

function UnifiedHomeRoute(props: DashboardPageProxyProps) {
  const { data, isLoading, isError } = useMergedPreferencesQuery();
  const redirectUri = data?.spec?.homeURL;
  const homeDashboardUID = data?.spec?.homeDashboardUID;
  // homeDashboardUID takes precedence over homeURL; the setup guide redirect is superseded by the new homepage
  const willRedirect = !!redirectUri && !homeDashboardUID && redirectUri !== SETUP_GUIDE_HOME_URL;

  useEffect(() => {
    if (!willRedirect) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(redirectUri, locationService.getLocation());
    // Landing-page resolution, not a navigation: journey trackers keep previousUrl absent.
    locationService.replace(markAsUrlRewrite(newUrl));
  }, [willRedirect, redirectUri]);

  if (isLoading || willRedirect) {
    return <PageLoader />;
  }

  // Probe failed: we cannot tell whether a home dashboard is configured.
  // Fall back to the dashboard proxy so existing on-prem setups still work.
  if (isError || !data) {
    return <DashboardPageProxy {...props} />;
  }

  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  return <HomePage />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<PageLoader />}>
      <HomeRouteInner {...props} />
    </Suspense>
  );
}
