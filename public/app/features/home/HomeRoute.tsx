import { lazy, Suspense } from 'react';

import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { LoadingPlaceholder } from '@grafana/ui';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

export default function HomeRoute(props: DashboardPageProxyProps) {
  const unifiedHomepageEnabled = useFlagGrafanaUnifiedHomepage({ suspend: true });
  return (
    <Suspense fallback={<LoadingPlaceholder text="" />}>
      {unifiedHomepageEnabled ? <HomePage /> : <DashboardPageProxy {...props} />}
    </Suspense>
  );
}
