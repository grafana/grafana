import React from 'react';

import { Permissions } from 'app/core/components/AccessControl';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { DashboardModel } from '../../state';

interface Props {
  dashboard: DashboardModel;
}

export const AccessControlDashboardPermissions = ({ dashboard }: Props) => {
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return <Permissions resource={'dashboards'} resourceId={dashboard.uid} canSetPermissions={canSetPermissions} />;
};
