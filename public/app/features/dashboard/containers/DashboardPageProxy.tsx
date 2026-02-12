import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import DashboardScenePage from 'app/features/dashboard-scene/pages/DashboardScenePage';

import { isDashboardSceneEnabled } from '../../dashboard-scene/utils/utils';

import DashboardPage, { DashboardPageParams } from './DashboardPage';
import { DashboardPageRouteParams, DashboardPageRouteSearchParams } from './types';

export type DashboardPageProxyProps = Omit<
  GrafanaRouteComponentProps<DashboardPageRouteParams, DashboardPageRouteSearchParams>,
  'match'
>;

// This proxy component is used for Dashboard -> Scenes migration.
// When dashboardScene is enabled (default), it renders DashboardScenePage for all users.
// Otherwise - use the legacy DashboardPage ¯\_ (ツ)_/¯
function DashboardPageProxy(props: DashboardPageProxyProps) {
  const forceScenes = props.queryParams.scenes === true;
  const forceOld = props.queryParams.scenes === false;
  const params = useParams<DashboardPageParams>();
  const location = useLocation();

  const useScenes = forceScenes || (isDashboardSceneEnabled() && !forceOld);

  if (useScenes) {
    return <DashboardScenePage {...props} />;
  }

  return <DashboardPage {...props} params={params} location={location} />;
}

export default DashboardPageProxy;
