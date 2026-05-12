import { lazy, Suspense, useEffect } from 'react';
import { useAsync } from 'react-use';

import { locationUtil } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { LoadingPlaceholder } from '@grafana/ui';
import { type DashboardDTO, isRedirectResponse } from 'app/types/dashboard';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

function isBundledDefaultHome(dto: DashboardDTO): boolean {
  return dto.meta?.isDefaultHome === true;
}

function HomeRouteInner(props: DashboardPageProxyProps) {
  const flagOn = useFlagGrafanaUnifiedHomepage({ suspend: true });
  return flagOn ? <UnifiedHomeRoute {...props} /> : <DashboardPageProxy {...props} />;
}

function UnifiedHomeRoute(props: DashboardPageProxyProps) {
  const { loading, value, error } = useAsync(() => getBackendSrv().get('/api/dashboards/home'), []);

  useEffect(() => {
    if (!value || !isRedirectResponse(value)) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(value.redirectUri, locationService.getLocation());
    locationService.replace(newUrl);
  }, [value]);

  if (loading || (value && isRedirectResponse(value))) {
    return <LoadingPlaceholder text="" />;
  }

  if (error || !value || !isBundledDefaultHome(value)) {
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
