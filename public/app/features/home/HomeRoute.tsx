import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { LoadingPlaceholder } from '@grafana/ui';

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

  // TODO remove type check after BE support and schema is added
  const rawRedirectUri = data?.spec?.redirectUri;
  const redirectUri = typeof rawRedirectUri === 'string' ? rawRedirectUri : '';

  useEffect(() => {
    if (!redirectUri) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(redirectUri, locationService.getLocation());
    locationService.replace(newUrl);
  }, [redirectUri]);

  if (isLoading || redirectUri) {
    return <LoadingPlaceholder text="" />;
  }

  // Probe failed: we cannot tell whether a home dashboard is configured.
  // Fall back to the dashboard proxy so existing on-prem setups still work.
  if (isError || !data) {
    return <DashboardPageProxy {...props} />;
  }

  // TODO remove type check after BE schema is updated
  const rawUID = data.spec?.homeDashboardUID;
  const homeDashboardUID = typeof rawUID === 'string' ? rawUID : '';
  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  return <HomePage />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<LoadingPlaceholder text="" />}>
      <HomeRouteInner {...props} />
    </Suspense>
  );
}
