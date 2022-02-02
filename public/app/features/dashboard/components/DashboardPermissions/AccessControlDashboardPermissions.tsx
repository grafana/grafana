import React from 'react';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { Permissions } from 'app/core/components/AccessControl';

interface Props {
  id: number;
}

export const AccessControlDashboardPermissions = ({ id }: Props) => {
  const canListUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
  const canSetPermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPermissionsWrite);

  return (
    <Permissions
      resource={'dashboards'}
      resourceId={id}
      canListUsers={canListUsers}
      canSetPermissions={canSetPermissions}
    />
  );
};
