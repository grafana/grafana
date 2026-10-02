import { skipToken } from '@reduxjs/toolkit/query';
import { useState } from 'react';

import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Alert, Button, Stack, Text } from '@grafana/ui';
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

import { useGetOverviewOrgsQuery, useGetOverviewSessionsQuery, useGetOverviewLdapStatusQuery } from './api';

interface Props {
  user: UserDTO;
  onUpdated: () => void;
}

export function useUserAction(onUpdated: () => void) {
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const run = async (action: () => Promise<unknown>, refresh = true) => {
    setFailed(false);
    setPending(true);
    try {
      await action();
      if (refresh) {
        onUpdated();
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  return { run, pending, failed };
}

export function ActionError() {
  return (
    <Alert severity="error" title={t('admin.user-overview.update-error', 'Unable to update user. Please try again.')} />
  );
}

export function AccountManagement({ user, onUpdated }: Props) {
  const { run, failed } = useUserAction(onUpdated);
  return (
    <Stack direction="column" gap={3}>
      {failed && <ActionError />}
      <UserAccountActions
        user={user}
        onUserDelete={() =>
          run(async () => {
            await getBackendSrv().delete(`/api/admin/users/${user.uid}`);
            locationService.push('/admin/users');
          }, false)
        }
        onUserDisable={() => run(() => getBackendSrv().post(`/api/admin/users/${user.uid}/disable`))}
        onUserEnable={() => run(() => getBackendSrv().post(`/api/admin/users/${user.uid}/enable`))}
      />
    </Stack>
  );
}

export function OrganizationsTab({ user, onUpdated }: Props) {
  const { currentData: orgs, isFetching, error, refetch } = useGetOverviewOrgsQuery(user.uid);
  const { run, failed } = useUserAction(() => {
    refetch();
    onUpdated();
  });
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.orgs-error', 'Unable to load organizations')} />;
  }
  if (!orgs) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {failed && <ActionError />}
      <UserOrgs
        showHeading={false}
        key={isFetching ? 'loading' : 'loaded'}
        user={user}
        orgs={orgs}
        isExternalUser={user.isExternallySynced || user.isProvisioned}
        onOrgAdd={(orgId, role) =>
          run(() => getBackendSrv().post(`/api/orgs/${orgId}/users/`, { loginOrEmail: user.login, role }))
        }
        onOrgRemove={(orgId) => run(() => getBackendSrv().delete(`/api/orgs/${orgId}/users/${user.uid}`))}
        onOrgRoleChange={(orgId, role) =>
          run(() => getBackendSrv().patch(`/api/orgs/${orgId}/users/${user.uid}`, { role }))
        }
      />
    </Stack>
  );
}

export function SessionsTab({ uid }: { uid: string }) {
  const { currentData: sessions, error, refetch } = useGetOverviewSessionsQuery(uid);
  const { run, failed } = useUserAction(refetch);
  if (error) {
    return <Alert severity="warning" title={t('admin.user-overview.sessions-error', 'Unable to load sessions')} />;
  }
  if (!sessions) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  return (
    <Stack direction="column" gap={2}>
      {failed && <ActionError />}
      <UserSessions
        showHeading={false}
        sessions={sessions}
        onSessionRevoke={(authTokenId) =>
          run(() => getBackendSrv().post(`/api/admin/users/${uid}/revoke-auth-token`, { authTokenId }))
        }
        onAllSessionsRevoke={() => run(() => getBackendSrv().post(`/api/admin/users/${uid}/logout`))}
      />
    </Stack>
  );
}

export function AuthenticationTab({ user, onUpdated }: Props) {
  const { currentData: status, error, refetch } = useGetOverviewLdapStatusQuery();
  const { run, failed } = useUserAction(() => {
    refetch();
    onUpdated();
  });
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
      {failed && <ActionError />}
      <UserLdapSyncInfo
        showHeading={false}
        user={user}
        ldapSyncInfo={status}
        onUserSync={() => run(() => getBackendSrv().post(`/api/admin/ldap/sync/${user.id}`))}
      />
    </Stack>
  );
}

function isBasicRole(role: string): role is OrgRole {
  return Object.values(OrgRole).some((value) => value === role);
}

export function UserRolesEditor({
  user,
  basicRole,
  onUpdated,
}: {
  user: Pick<UserDTO, 'id' | 'uid' | 'isExternallySynced' | 'isProvisioned'>;
  basicRole: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { run, failed, pending } = useUserAction(onUpdated);
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canEditBasic =
    contextSrv.hasPermission(AccessControlAction.OrgUsersWrite) && !user.isExternallySynced && !user.isProvisioned;
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
  const updateBasic = (role: OrgRole) => run(() => getBackendSrv().patch(`/api/org/users/${user.id}`, { role }));
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
