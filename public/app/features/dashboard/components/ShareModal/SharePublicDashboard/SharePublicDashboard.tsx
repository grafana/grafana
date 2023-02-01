import React, { useEffect } from 'react';
import { Subscription } from 'rxjs';

import { reportInteraction } from '@grafana/runtime/src';
import { Spinner, useForceUpdate } from '@grafana/ui/src';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';

import { DashboardMetaChangedEvent } from '../../../../../types/events';

import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
interface Props extends ShareModalTabProps {}

export const SharePublicDashboard = (props: Props) => {
  const forceUpdate = useForceUpdate();

  const {
    isLoading: isGetLoading,
    data: publicDashboard,
    // isError: isGetError,
    isFetching,
  } = useGetPublicDashboardQuery(props.dashboard.uid);

  useEffect(() => {
    const eventSubs = new Subscription();
    eventSubs.add(props.dashboard.events.subscribe(DashboardMetaChangedEvent, forceUpdate));
    reportInteraction('grafana_dashboards_public_share_viewed');

    return () => eventSubs.unsubscribe();
  }, [props.dashboard.events, forceUpdate]);

  return (
    <>
      {isGetLoading || isFetching ? (
        <Spinner />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard />
      ) : (
        <ConfigPublicDashboard dashboard={props.dashboard} publicDashboard={publicDashboard!} />
      )}
    </>
  );
};
