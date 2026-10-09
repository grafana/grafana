import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button, Stack, Text } from '@grafana/ui';
import {
  useGetUserOrgListQuery,
  useAdminGetUserAuthTokensQuery,
  useGetSyncStatusQuery,
  useAdminDeleteUserMutation,
  useAdminDisableUserMutation,
  useAdminEnableUserMutation,
  useAddOrgUserMutation,
  useRemoveOrgUserMutation,
  useUpdateOrgUserMutation,
  useUpdateOrgUserForCurrentOrgMutation,
  useAdminRevokeUserAuthTokenMutation,
  useAdminLogoutUserMutation,
  usePostSyncUserWithLdapMutation,
} from 'app/api/clients/legacy';
import { useListRolesQuery } from 'app/api/clients/roles';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

import { OrgRolePicker } from '../OrgRolePicker';
import { UserAccountActions } from '../UserAccountActions';
import { UserLdapSyncInfo } from '../UserLdapSyncInfo';
import { UserOrgs } from '../UserOrgs';
import { UserSessions } from '../UserSessions';
import { getBasicRoleDisabled } from '../Users/userRolePermissions';

import { type OverviewUser } from './api';

interface Props {
  user: UserDTO;
}

export function ActionError() {
  return (
    <Alert severity="error" title={t('admin.user-overview.update-error', 'Unable to update user. Please try again.')} />
  );
}

export function AccountManagement({ user }: Props) {
  const [deleteUser, deletion] = useAdminDeleteUserMutation();
  const [disableUser, disabling] = useAdminDisableUserMutation();
  const [enableUser, enabling] = useAdminEnableUserMutation();
  return (
    <Stack direction="column" gap={3}>
      {(deletion.isError || disabling.isError || enabling.isError) && <ActionError />}
      <UserAccountActions
        user={user}
        onUserDelete={async () => {
          if (!('error' in (await deleteUser({ userId: user.uid })))) {
            locationService.push('/admin/users');
          }
        }}
        onUserDisable={() => disableUser({ userId: user.uid })}
        onUserEnable={() => enableUser({ userId: user.uid })}
      />
    </Stack>
  );
}

export function OrganizationsTab({ user }: Props) {
  const [addOrgUser, adding] = useAddOrgUserMutation();
  const [removeOrgUser, removing] = useRemoveOrgUserMutation();
  const [updateOrgRole, updating] = useUpdateOrgUserMutation();
  const { currentData: orgs, error } = useGetUserOrgListQuery({ userId: user.uid });
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.orgs-error', 'Unable to load organizations')} />;
  }
  if (!orgs) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {(adding.isError || removing.isError || updating.isError) && <ActionError />}
      <UserOrgs
        user={user}
        orgs={orgs}
        isExternalUser={user.isExternallySynced || user.isProvisioned}
        onOrgAdd={(orgId, role) => addOrgUser({ orgId, addOrgUserCommand: { loginOrEmail: user.login, role } })}
        onOrgRemove={(orgId) => removeOrgUser({ orgId, userId: user.uid })}
        onOrgRoleChange={(orgId, role) => updateOrgRole({ orgId, userId: user.uid, updateOrgUserCommand: { role } })}
      />
    </Stack>
  );
}

export function SessionsTab({ uid }: { uid: string }) {
  const [revokeSession, revoking] = useAdminRevokeUserAuthTokenMutation();
  const [revokeSessions, revokingAll] = useAdminLogoutUserMutation();
  const { currentData: sessions, error } = useAdminGetUserAuthTokensQuery({ userId: uid });
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.sessions-error', 'Unable to load sessions')} />;
  }
  if (!sessions) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {(revoking.isError || revokingAll.isError) && <ActionError />}
      <UserSessions
        sessions={sessions}
        onSessionRevoke={(authTokenId) => revokeSession({ userId: uid, revokeAuthTokenCmd: { authTokenId } })}
        onAllSessionsRevoke={() => revokeSessions({ userId: uid })}
      />
    </Stack>
  );
}

export function AuthenticationTab({ user }: Props) {
  const [syncUser, syncing] = usePostSyncUserWithLdapMutation();
  const { currentData: status, error } = useGetSyncStatusQuery();
  if (error) {
    return (
      <Alert
        severity="warning"
        title={t('admin.user-overview.ldap-error', 'Unable to load authentication information')}
      />
    );
  }
  if (!status) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {syncing.isError && <ActionError />}
      <UserLdapSyncInfo user={user} ldapSyncInfo={status} onUserSync={() => syncUser({ userId: user.id })} />
    </Stack>
  );
}

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
