import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { type GrafanaRouteComponentProps } from 'app/core/navigation/types';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';

import DashboardPage, { type DashboardPageParams } from './DashboardPage';
import { type DashboardPageRouteParams, type DashboardPageRouteSearchParams } from './types';

export type DashboardPageProxyProps = Omit<
  GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>,
  'match'
>;

// This proxy component is used for Dashboard -> Scenes migration.
// When dashboardScene is enabled (default), it renders DashboardScenePage for all users.
// Otherwise - use the legacy DashboardPage ¯\_ (ツ)_/¯
function DashboardPageProxy(props: DashboardPageProxyProps) {
  const forceOld = props.queryParams.scenes === false;
  const params = useParams<DashboardPageParams>();
  const location = useLocation();

  if (forceOld) {
    <DashboardPage {...props} params={params} location={location} />;
  }

  return <DashboardScenePage {...props} />;
}

export default DashboardPageProxy;
