import { t } from '@grafana/i18n';
import { Permissions } from 'app/core/components/AccessControl';
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
      title={t('serviceaccounts.service-account-permissions.title-permissions', 'Permissions')}
      addPermissionTitle="Add permission"
      buttonLabel="Add permission"
      resource="serviceaccounts"
      resourceId={props.serviceAccount.uid}
      canSetPermissions={canSetPermissions}
    />
  );
};
