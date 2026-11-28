import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import {
  useAdminUpdateUserPasswordMutation,
  useAdminUpdateUserPermissionsMutation,
  useUpdateUserMutation,
} from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AccountActions } from './AccountActions';
import { ActionError } from './ActionError';
import { BooleanRow, DetailRow, DetailTable, TextRow } from './DetailRows';
import { LoadError, LoadState } from './LoadState';
import { type OverviewUser, useAction, useUserOverview } from './hooks';

function formatLastActive({ lastSeenAt, createdAt }: OverviewUser) {
  if (!lastSeenAt) {
    return undefined;
  }
  const lastSeen = Date.parse(lastSeenAt);
  // An account that never signed in carries a last-seen time from before its creation.
  if (!lastSeen || (createdAt && lastSeen < Date.parse(createdAt))) {
    return t('admin.user-overview.never', 'Never');
  }
  return `${dateTimeFormatTimeAgo(lastSeen)} (${dateTimeFormat(lastSeen)})`;
}

export function UserDetails({ uid }: { uid: string }) {
  const { user, profile, account, members, isMembershipUnknown } = useUserOverview(uid);
  const { run, error } = useAction();
  const [updateProfile, profileUpdate] = useUpdateUserMutation();
  const [updatePassword] = useAdminUpdateUserPasswordMutation();
  const [updateAdmin] = useAdminUpdateUserPermissionsMutation();
  if (!user) {
    return null;
  }

  const can = (action: AccessControlAction) => !!profile && contextSrv.hasPermissionInMetadata(action, profile);
  const managedExternally = t('admin.user-overview.managed-externally', 'Managed externally');
  const profileLock = user.isExternal || user.isProvisioned ? managedExternally : undefined;
  const adminLock = profile?.isGrafanaAdminExternallySynced || user.isProvisioned ? managedExternally : undefined;
  const yes = t('admin.user-overview.yes', 'Yes');
  const no = t('admin.user-overview.no', 'No');

  // A field closes once the account is read again, so that it shows what the server stored.
  const stored = (update: Promise<unknown>) => run(update.then(() => account.refetch().unwrap()));
  // A profile save sends login, name and email together. A second save waits for the first and the
  // account it stored: sent earlier, it would write back a value from before the first save.
  const savingProfile = profileUpdate.isLoading || account.isFetching;
  const saveProfile = (field: 'login' | 'name' | 'email') => {
    if (profileLock || !can(AccessControlAction.UsersWrite)) {
      return undefined;
    }
    return (value: string) =>
      stored(
        updateProfile({
          userId: uid,
          updateUserCommand: { login: user.login, name: user.name, email: user.email, [field]: value },
        }).unwrap()
      );
  };
  const savePassword =
    profileLock || !can(AccessControlAction.UsersPasswordUpdate)
      ? undefined
      : (password: string) => run(updatePassword({ userId: uid, adminUpdateUserPasswordForm: { password } }).unwrap());
  const saveAdmin =
    adminLock || !can(AccessControlAction.UsersPermissionsUpdate)
      ? undefined
      : (isGrafanaAdmin: boolean) =>
          stored(updateAdmin({ userId: uid, adminUpdateUserPermissionsForm: { isGrafanaAdmin } }).unwrap());

  return (
    <Stack direction="column" gap={3}>
      {Boolean(error) && <ActionError error={error} />}
      <DetailTable>
        <TextRow
          label={t('admin.user-overview.login', 'Login')}
          value={user.login}
          locked={profileLock}
          onSave={saveProfile('login')}
          busy={savingProfile}
        />
        <TextRow
          label={t('admin.user-overview.name', 'Name')}
          value={user.name}
          locked={profileLock}
          onSave={saveProfile('name')}
          busy={savingProfile}
        />
        <TextRow
          label={t('admin.user-overview.email', 'Email')}
          value={user.email}
          type="email"
          locked={profileLock}
          onSave={saveProfile('email')}
          busy={savingProfile}
        />
        <DetailRow
          label={t('admin.user-overview.origin', 'Origin')}
          value={[...new Set(user.authLabels)].join(', ') || t('admin.user-overview.local', 'Grafana')}
        />
        <DetailRow label={t('admin.user-overview.provisioned', 'Provisioned')} value={user.isProvisioned ? yes : no} />
        <DetailRow
          label={t('admin.user-overview.status', 'Status')}
          value={
            user.isDisabled
              ? t('admin.user-overview.disabled', 'Disabled')
              : t('admin.user-overview.enabled', 'Enabled')
          }
        />
        <DetailRow
          label={t('admin.user-overview.created', 'Created')}
          value={user.createdAt && dateTimeFormat(user.createdAt)}
        />
        <DetailRow label={t('admin.user-overview.last-active', 'Last active')} value={formatLastActive(user)} />
        {profile && (
          <>
            <BooleanRow
              label={t('admin.user-overview.grafana-admin', 'Grafana admin')}
              value={profile.isGrafanaAdmin}
              locked={adminLock}
              onSave={saveAdmin}
            />
            <DetailRow
              label={t('admin.user-profile.label-numerical-identifier', 'Numerical identifier')}
              value={String(user.id)}
            />
          </>
        )}
        {savePassword && (
          <TextRow
            label={t('admin.user-profile.label-password', 'Password')}
            value=""
            type="password"
            onSave={savePassword}
          />
        )}
      </DetailTable>
      {profile && <AccountActions user={profile} run={run} />}
      {(account.isLoading || members.isLoading) && <LoadState />}
      {Boolean(account.error) && <LoadError error={account.error} />}
      {(Boolean(members.error) || isMembershipUnknown) && <LoadError error={members.error} />}
    </Stack>
  );
}
