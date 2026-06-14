import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { GrafanaRouteLoading } from 'app/core/navigation/GrafanaRouteLoading';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const homePageImport = () => import(/* webpackChunkName: "HomePage" */ './HomePage');
const HomePage = lazy(homePageImport);

function HomeRouteInner(props: DashboardPageProxyProps) {
  const flagOn = useFlagGrafanaUnifiedHomepage({ suspend: true });
  return flagOn ? <UnifiedHomeRoute {...props} /> : <DashboardPageProxy {...props} />;
}

function UnifiedHomeRoute(props: DashboardPageProxyProps) {
  const { data, isLoading, isError } = useMergedPreferencesQuery();
  const redirectUri = data?.spec?.homeURL;

  // Warm the HomePage chunk in parallel with the preferences probe, so the
  // lazy component resolves instantly once the probe finishes
  useEffect(() => {
    homePageImport();
  }, []);

  useEffect(() => {
    if (!redirectUri) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(redirectUri, locationService.getLocation());
    locationService.replace(newUrl);
  }, [redirectUri]);

  if (isLoading || redirectUri) {
    return <GrafanaRouteLoading />;
  }

  // Probe failed: we cannot tell whether a home dashboard is configured.
  // Fall back to the dashboard proxy so existing on-prem setups still work.
  if (isError || !data) {
    return <DashboardPageProxy {...props} />;
  }

  const homeDashboardUID = data.spec?.homeDashboardUID;
  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  return <HomePage />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<GrafanaRouteLoading />}>
      <HomeRouteInner {...props} />
    </Suspense>
  );
}
