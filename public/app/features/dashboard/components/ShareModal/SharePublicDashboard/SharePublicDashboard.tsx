import React, { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime/src';
import { Spinner } from '@grafana/ui/src';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';

import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
interface Props extends ShareModalTabProps {}

export const SharePublicDashboard = (props: Props) => {
  const { isLoading: isGetLoading, data: publicDashboard } = useGetPublicDashboardQuery(props.dashboard.uid);

  useEffect(() => {
    reportInteraction('grafana_dashboards_public_share_viewed');
  }, []);

  return (
    <>
      {isGetLoading ? (
        <Spinner />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard />
      ) : (
        <ConfigPublicDashboard />
      )}
    </>
  );
};
