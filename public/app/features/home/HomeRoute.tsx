import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PageLoader } from '@grafana/ui';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

function HomeRouteInner(props: DashboardPageProxyProps) {
  const { data, isLoading } = useMergedPreferencesQuery();
  const redirectUri = data?.spec?.homeURL;
  const homeDashboardUID = data?.spec?.homeDashboardUID;
  // homeDashboardUID takes precedence over homeURL
  const willRedirect = !!redirectUri && !homeDashboardUID;

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

  // Prefer a known home dashboard UID (including cached data after a failed refetch)
  // over the error fallback so a transient prefs failure does not replace a configured home.
  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  // Empty/absent UID, or prefs probe failed with no UID available → unified homepage
  return <HomePage />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<PageLoader />}>
      <HomeRouteInner {...props} />
    </Suspense>
  );
}
