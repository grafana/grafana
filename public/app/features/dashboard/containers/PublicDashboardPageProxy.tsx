import { config } from '@grafana/runtime';

import { PublicDashboardScenePage } from '../../dashboard-scene/pages/PublicDashboardScenePage';

import PublicDashboardPage, { type Props } from './PublicDashboardPage';

export type PublicDashboardPageProxyProps = Props;

function PublicDashboardPageProxy(props: PublicDashboardPageProxyProps) {
  if (config.featureToggles.publicDashboardsScene) {
    return <PublicDashboardScenePage {...props} />;
  }

  return <PublicDashboardPage {...props} />;
}

export default PublicDashboardPageProxy;
