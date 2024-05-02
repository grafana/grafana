import React from 'react';

import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { Loader } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ConfigEmailSharing } from './ConfigEmailSharing/ConfigEmailSharing';
import { CreateEmailSharing } from './CreateEmailSharing';

export const EmailSharing = ({ dashboard, onCancel }: { dashboard: DashboardScene; onCancel: () => void }) => {
  const { data: publicDashboard, isLoading, isError } = useGetPublicDashboardQuery(dashboard.state.uid!);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreateEmailSharing dashboard={dashboard} onCancel={onCancel} hasError={isError} />
      ) : (
        <ConfigEmailSharing dashboard={dashboard} />
      )}
    </>
  );
};
