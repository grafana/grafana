import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';

import { useShareDrawerContext } from '../../../ShareDrawer/ShareDrawerContext';
import ShareConfiguration from '../ShareConfiguration';

import CreatePublicSharing from './CreatePublicSharing';

export function PublicSharing() {
  const { dashboard } = useShareDrawerContext();
  const { data: publicDashboard, isError } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  return <>{!publicDashboard ? <CreatePublicSharing hasError={isError} /> : <ShareConfiguration />}</>;
}
