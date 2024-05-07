import React from 'react';

import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import ConfigPublicSharing from './ConfigPublicSharing';
import CreatePublicSharing from './CreatePublicSharing';

export const PublicSharing = ({ dashboard, onCancel }: { dashboard: DashboardScene; onCancel: () => void }) => {
  const { data: publicDashboard, isError } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  return (
    <>
      {!publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicSharing dashboard={dashboard} onCancel={onCancel} hasError={isError} />
      ) : (
        <ConfigPublicSharing dashboard={dashboard} />
      )}
    </>
  );
};
