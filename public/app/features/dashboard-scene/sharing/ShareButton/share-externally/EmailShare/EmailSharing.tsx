import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';

import { useShareDrawerContext } from '../../../ShareDrawer/ShareDrawerContext';

import { ConfigEmailSharing } from './ConfigEmailSharing/ConfigEmailSharing';
import { CreateEmailSharing } from './CreateEmailSharing';

export const EmailSharing = () => {
  const { dashboard } = useShareDrawerContext();
  const { data: publicDashboard, isError } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  return <>{!publicDashboard ? <CreateEmailSharing hasError={isError} /> : <ConfigEmailSharing />}</>;
};
