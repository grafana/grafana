import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountDTO } from 'app/types/serviceaccount';

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
      addPermissionTitle="Add permission"
      buttonLabel="Add permission"
      resource="serviceaccounts"
      resourceId={props.serviceAccount.uid}
      canSetPermissions={canSetPermissions}
    />
  );
};
