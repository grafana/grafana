import { PublicDashboardScenePage } from '../../dashboard-scene/pages/PublicDashboardScenePage';
import { isPublicDashboardsSceneEnabled } from '../../dashboard-scene/utils/utils';

import PublicDashboardPage, { type Props } from './PublicDashboardPage';

export type PublicDashboardPageProxyProps = Props;

function PublicDashboardPageProxy(props: PublicDashboardPageProxyProps) {
  if (isPublicDashboardsSceneEnabled()) {
    return <PublicDashboardScenePage {...props} />;
  }

  return <PublicDashboardPage {...props} />;
}

export default PublicDashboardPageProxy;
