import { useState, useCallback, useMemo } from 'react';

import { Alert, Button } from '@grafana/ui';
import { useListUserRolesQuery } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ServiceAccountDTO } from 'app/types/serviceaccount';

import { AddServiceAccountRoleModal } from './AddServiceAccountRoleModal';
import { ServiceAccountRolesTable } from './ServiceAccountRolesTable';

interface Props {
  serviceAccount: ServiceAccountDTO;
}

export const ServiceAccountRolesPage = ({ serviceAccount }: Props) => {
  const isEnterprise = contextSrv.licensedAccessControlEnabled();
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  const canAddRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);

  // Fetch service account roles (service accounts are users internally)
  const {
    data: roles = [],
    isLoading,
    refetch,
  } = useListUserRolesQuery({
    userId: serviceAccount.id,
    includeHidden: false,
    targetOrgId: serviceAccount.orgId,
  });

  // Get current role UIDs (directly assigned only, excluding mapped roles)
  const currentRoleUids = useMemo(() => {
    return roles.filter((role) => !role.mapped).map((role) => role.uid);
  }, [roles]);

  const handleRolesChanged = useCallback(() => {
    refetch();
  }, [refetch]);

  // Show enterprise feature notice in OSS mode
  if (!isEnterprise) {
    return (
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      <Alert severity="info" title="Enterprise Feature">
        Role management requires Grafana Enterprise with RBAC enabled. Contact your administrator or visit
        grafana.com to learn more about Grafana Enterprise.
      </Alert>
    );
  }

  return (
    <>
      {!isLoading && (
        <>
          <ServiceAccountRolesTable
            roles={roles}
            serviceAccountId={serviceAccount.id}
            serviceAccountOrgId={serviceAccount.orgId}
            onRolesChanged={handleRolesChanged}
          />

          {canAddRoles && !serviceAccount.isDisabled && !serviceAccount.isExternal && (
            <>
              <Button variant="primary" icon="plus" onClick={() => setIsAddRoleModalOpen(true)}>
                Add Role
              </Button>
              <AddServiceAccountRoleModal
                isOpen={isAddRoleModalOpen}
                serviceAccountId={serviceAccount.id}
                serviceAccountOrgId={serviceAccount.orgId}
                currentRoleUids={currentRoleUids}
                onDismiss={() => setIsAddRoleModalOpen(false)}
                onRoleAdded={() => {
                  setIsAddRoleModalOpen(false);
                  handleRolesChanged();
                }}
              />
            </>
          )}
        </>
      )}
    </>
  );
};
