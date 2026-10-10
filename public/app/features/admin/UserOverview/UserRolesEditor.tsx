import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { useUpdateOrgUserForCurrentOrgMutation } from 'app/api/clients/legacy';
import { useListRolesQuery } from 'app/api/clients/roles';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { OrgRolePicker } from '../OrgRolePicker';
import { getBasicRoleDisabled } from '../Users/userRolePermissions';

import { ActionError } from './ActionError';
import { type OverviewUser } from './api';

function isBasicRole(role: string): role is OrgRole {
  return Object.values(OrgRole).some((value) => value === role);
}

export function UserRolesEditor({ user, basicRole }: { user: OverviewUser; basicRole: string }) {
  const [editing, setEditing] = useState(false);
  const [updateBasicRole, { isError: failed, isLoading: pending }] = useUpdateOrgUserForCurrentOrgMutation();
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canEditBasic = !getBasicRoleDisabled({ ...user, accessControl: user.orgAccessControl });
  const canEditDirect =
    licensed &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
  const options = useListRolesQuery(
    editing && canEditDirect ? { delegatable: true, targetOrgId: contextSrv.user.orgId } : skipToken
  );
  if ((!canEditBasic && !canEditDirect) || !isBasicRole(basicRole)) {
    return null;
  }
  const updateBasic = (role: OrgRole) => updateBasicRole({ userId: user.id, updateOrgUserCommand: { role } });
  return (
    <Stack direction="column" gap={2}>
      {failed && <ActionError />}
      {editing ? (
        <Stack gap={2}>
          {canEditDirect ? (
            <UserRolePicker
              userId={user.id}
              orgId={contextSrv.user.orgId}
              basicRole={basicRole}
              roleOptions={options.data ?? []}
              isLoading={options.isFetching || pending}
              disabled={!!options.error}
              basicRoleDisabled={!canEditBasic}
              onBasicRoleChange={updateBasic}
            />
          ) : (
            <OrgRolePicker
              value={basicRole}
              onChange={updateBasic}
              disabled={pending}
              aria-label={t('admin.user-overview.basic', 'Basic role')}
            />
          )}
          <Button variant="secondary" onClick={() => setEditing(false)}>
            {t('admin.user-overview.done', 'Done')}
          </Button>
        </Stack>
      ) : (
        <div>
          <Button variant="secondary" icon="pen" onClick={() => setEditing(true)}>
            {t('admin.user-overview.edit-roles', 'Edit roles')}
          </Button>
        </div>
      )}
      {Boolean(options.error) && (
        <Alert
          severity="warning"
          title={t('admin.user-overview.role-options-error', 'Unable to load available roles')}
        />
      )}
    </Stack>
  );
}
