import React from 'react';

// @todo: replace barrel import path
import { Permissions } from 'app/core/components/AccessControl/index';
import { contextSrv } from 'app/core/services/context_srv';

// @todo: replace barrel import path
import { AccessControlAction, ServiceAccountDTO } from '../../types/index';

type ServiceAccountPermissionsProps = {
  serviceAccount: ServiceAccountDTO;
};

export const ServiceAccountPermissions = (props: ServiceAccountPermissionsProps) => {
  const canSetPermissions = contextSrv.hasPermissionInMetadata(
    AccessControlAction.ServiceAccountsPermissionsWrite,
    props.serviceAccount
  );

  return (
    <Permissions
      title="Permissions"
      addPermissionTitle="Add permission"
      buttonLabel="Add permission"
      resource="serviceaccounts"
      resourceId={props.serviceAccount.id}
      canSetPermissions={canSetPermissions}
    />
  );
};
