import { PublicDashboardScenePage, type Props } from '../../dashboard-scene/pages/PublicDashboardScenePage';

export type PublicDashboardPageProxyProps = Props;

function PublicDashboardPageProxy(props: PublicDashboardPageProxyProps) {
  return <PublicDashboardScenePage {...props} />;
}

export default PublicDashboardPageProxy;
