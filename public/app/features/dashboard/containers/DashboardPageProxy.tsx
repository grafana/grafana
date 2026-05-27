import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';

import { type DashboardPageRouteParams, type DashboardPageRouteSearchParams } from './types';

export type DashboardPageProxyProps = Omit<
  GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>,
  'match'
>;

function DashboardPageProxy(props: DashboardPageProxyProps) {
  return <DashboardScenePage {...props} />;
}

export default DashboardPageProxy;
