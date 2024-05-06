import React from 'react';

import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ConfigEmailSharing } from './ConfigEmailSharing/ConfigEmailSharing';
import { CreateEmailSharing } from './CreateEmailSharing';

export const EmailSharing = ({ dashboard, onCancel }: { dashboard: DashboardScene; onCancel: () => void }) => {
  const { data: publicDashboard, isError } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  return (
    <>
      {!publicDashboardPersisted(publicDashboard) ? (
        <CreateEmailSharing dashboard={dashboard} onCancel={onCancel} hasError={isError} />
      ) : (
        <ConfigEmailSharing dashboard={dashboard} />
      )}
    </>
  );
};
