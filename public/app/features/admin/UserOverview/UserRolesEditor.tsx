import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import { type OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { useUpdateOrgUserForCurrentOrgMutation } from 'app/api/clients/legacy';
import { useListRolesQuery } from 'app/api/clients/roles';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type OrgUser } from 'app/types/user';

import { OrgRolePicker } from '../OrgRolePicker';
import { getBasicRoleDisabled } from '../Users/userRolePermissions';

import { ActionError } from './ActionError';
import { useAction } from './hooks';

export function UserRolesEditor({ member }: { member: OrgUser }) {
  const [editing, setEditing] = useState(false);
  const [updateBasicRole, { isLoading: pending }] = useUpdateOrgUserForCurrentOrgMutation();
  const { run, error } = useAction();
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canEditBasic = !getBasicRoleDisabled(member);
  const canEditDirect =
    licensed &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
  const options = useListRolesQuery(
    editing && canEditDirect ? { delegatable: true, targetOrgId: contextSrv.user.orgId } : skipToken
  );
  if (!canEditBasic && !canEditDirect) {
    return null;
  }

  const updateBasic = (role: OrgRole) => {
    const update = updateBasicRole({ userId: member.userId, updateOrgUserCommand: { role } }).unwrap();
    run(update);
    // The role picker awaits the write itself, to drop its selection when the server rejects it.
    return update;
  };

  return (
    <Stack direction="column" gap={2}>
      {Boolean(error) && <ActionError error={error} />}
      {editing ? (
        <Stack gap={2}>
          {canEditDirect ? (
            <UserRolePicker
              userId={member.userId}
              orgId={contextSrv.user.orgId}
              basicRole={member.role}
              roleOptions={options.data ?? []}
              isLoading={options.isFetching || pending}
              disabled={!!options.error}
              basicRoleDisabled={!canEditBasic}
              onBasicRoleChange={updateBasic}
              onRolesUpdate={run}
            />
          ) : (
            <OrgRolePicker
              value={member.role}
              onChange={(role) => {
                run(updateBasicRole({ userId: member.userId, updateOrgUserCommand: { role } }).unwrap());
              }}
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
