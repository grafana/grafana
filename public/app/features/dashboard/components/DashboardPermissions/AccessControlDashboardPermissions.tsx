import React from 'react';
import { contextSrv } from 'app/core/core';
import { DashboardModel } from '../../state';
import { AccessControlAction } from 'app/types';
import { Permissions } from 'app/core/components/AccessControl';

interface Props {
  dashboard: DashboardModel;
}

export const AccessControlDashboardPermissions = ({ dashboard }: Props) => {
  const canListUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return (
    <Permissions
      resource={'dashboards'}
      resourceId={dashboard.uid}
      canListUsers={canListUsers}
      canSetPermissions={canSetPermissions}
    />
  );
};
