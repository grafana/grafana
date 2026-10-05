import { css } from '@emotion/css';
import { useState } from 'react';

import { type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Input, RadioButtonGroup, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AccountManagement, ActionError, useUserAction } from './UserManagement';
import {
  type OverviewProfile,
  useUpdateOverviewProfileMutation,
  useUpdateOverviewPasswordMutation,
  useUpdateOverviewAdminMutation,
} from './api';

type EditableField = 'name' | 'email' | 'login' | 'password' | 'isGrafanaAdmin';
interface DetailField {
  label: string;
  value?: string;
  edit?: EditableField;
  locked?: string;
}

export function UserDetails({
  user,
  profile,
  hasLastSeen,
  onUpdated,
}: {
  user: User;
  profile?: OverviewProfile;
  hasLastSeen: boolean;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [value, setValue] = useState('');
  const [updateProfile] = useUpdateOverviewProfileMutation();
  const [updatePassword] = useUpdateOverviewPasswordMutation();
  const [updateAdmin] = useUpdateOverviewAdminMutation();
  const { run, failed, pending } = useUserAction(() => {
    setEditing(null);
    onUpdated();
  });
  const yes = t('admin.user-overview.yes', 'Yes');
  const no = t('admin.user-overview.no', 'No');
  const origins = profile?.authLabels ?? user.spec.externalAuthInfo?.map((auth) => auth.module);
  const origin = origins ? [...new Set(origins)].join(', ') || t('admin.user-overview.local', 'Grafana') : undefined;
  const provisioned = profile?.isProvisioned ?? user.spec.provisioned;
  const external = profile?.isExternal || provisioned;
  const synced = external ? t('admin.user-overview.managed-externally', 'Managed externally') : undefined;
  const can = (action: AccessControlAction) => !!profile && contextSrv.hasPermissionInMetadata(action, profile);
  const canEditProfile = can(AccessControlAction.UsersWrite) && !external;
  const canEditPassword = can(AccessControlAction.UsersPasswordUpdate) && !external;
  const canEditAdmin =
    can(AccessControlAction.UsersPermissionsUpdate) && !profile?.isGrafanaAdminExternallySynced && !provisioned;
  const isAdmin = profile?.isGrafanaAdmin ?? user.spec.grafanaAdmin;
  const created = user.metadata.creationTimestamp ?? profile?.createdAt;
  const lastSeen = user.status?.lastSeenAt ? user.status.lastSeenAt * 1000 : 0;
  const never = !lastSeen || (created && lastSeen < new Date(created).getTime());
  const fields: DetailField[] = [
    {
      label: t('admin.user-overview.login', 'Login'),
      value: profile?.login ?? user.spec.login,
      edit: canEditProfile ? 'login' : undefined,
      locked: synced,
    },
    {
      label: t('admin.user-overview.name', 'Name'),
      value: profile?.name ?? user.spec.title,
      edit: canEditProfile ? 'name' : undefined,
      locked: synced,
    },
    {
      label: t('admin.user-overview.email', 'Email'),
      value: profile?.email ?? user.spec.email,
      edit: canEditProfile ? 'email' : undefined,
      locked: synced,
    },
    { label: t('admin.user-overview.origin', 'Origin'), value: origin },
    { label: t('admin.user-overview.provisioned', 'Provisioned'), value: provisioned ? yes : no },
    {
      label: t('admin.user-overview.status', 'Status'),
      value:
        (profile?.isDisabled ?? user.spec.disabled)
          ? t('admin.user-overview.disabled', 'Disabled')
          : t('admin.user-overview.enabled', 'Enabled'),
    },
    { label: t('admin.user-overview.created', 'Created'), value: created ? dateTimeFormat(created) : undefined },
    {
      label: t('admin.user-overview.last-active', 'Last active'),
      value: !hasLastSeen
        ? undefined
        : never
          ? t('admin.user-overview.never', 'Never')
          : `${dateTimeFormatTimeAgo(lastSeen)} (${dateTimeFormat(lastSeen)})`,
    },
    {
      label: t('admin.user-overview.grafana-admin', 'Grafana admin'),
      value: isAdmin ? yes : no,
      edit: canEditAdmin ? 'isGrafanaAdmin' : undefined,
      locked:
        profile?.isGrafanaAdminExternallySynced || provisioned
          ? t('admin.user-overview.managed-externally', 'Managed externally')
          : undefined,
    },
    ...(profile
      ? [
          {
            label: t('admin.user-profile.label-numerical-identifier', 'Numerical identifier'),
            value: String(profile.id),
          },
        ]
      : []),
    ...(canEditPassword
      ? [{ label: t('admin.user-profile.label-password', 'Password'), value: '••••••••', edit: 'password' as const }]
      : []),
  ];

  const save = () => {
    if (!profile || !editing) {
      return;
    }
    const field = editing;
    run(() =>
      field === 'isGrafanaAdmin'
        ? updateAdmin({ uid: profile.uid, isGrafanaAdmin: value === 'true' }).unwrap()
        : field === 'password'
          ? updatePassword({ uid: profile.uid, password: value }).unwrap()
          : updateProfile({
              uid: profile.uid,
              profile: {
                name: profile.name,
                email: profile.email,
                login: profile.login,
                [field]: value,
              },
            }).unwrap()
    );
  };

  return (
    <Stack direction="column" gap={3}>
      {failed && <ActionError />}
      <table className="filter-table form-inline">
        <tbody>
          {fields.map((field) => (
            <tr key={field.label}>
              <td className={`width-16 ${labelStyle}`}>{field.label}</td>
              <td className="width-25" colSpan={2}>
                {field.edit && editing === field.edit ? (
                  <form
                    id={`user-field-${field.edit}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      save();
                    }}
                  >
                    {editing === 'isGrafanaAdmin' ? (
                      <RadioButtonGroup
                        options={[
                          { label: yes, value: 'true' },
                          { label: no, value: 'false' },
                        ]}
                        value={value}
                        onChange={setValue}
                        disabled={pending}
                      />
                    ) : (
                      <Input
                        aria-label={field.label}
                        value={value}
                        onChange={(event) => setValue(event.currentTarget.value)}
                        type={editing === 'password' ? 'password' : editing === 'email' ? 'email' : 'text'}
                        autoFocus
                        disabled={pending}
                        width={30}
                      />
                    )}
                  </form>
                ) : (
                  <span>{field.value || '—'}</span>
                )}
              </td>
              <td>
                {field.edit && editing === field.edit ? (
                  <Stack gap={1}>
                    <Button type="submit" form={`user-field-${field.edit}`} disabled={pending}>
                      {t('admin.user-overview.save', 'Save')}
                    </Button>
                    <Button fill="text" disabled={pending} onClick={() => setEditing(null)}>
                      {t('admin.user-overview.cancel', 'Cancel')}
                    </Button>
                  </Stack>
                ) : (
                  <>
                    {field.edit ? (
                      <Button
                        fill="text"
                        aria-label={t('admin.user-overview.edit-field', 'Edit {{field}}', { field: field.label })}
                        disabled={pending}
                        onClick={() => {
                          setEditing(field.edit!);
                          setValue(
                            field.edit === 'password'
                              ? ''
                              : field.edit === 'isGrafanaAdmin'
                                ? String(isAdmin)
                                : (field.value ?? '')
                          );
                        }}
                      >
                        {t('admin.user-profile.edit-button', 'Edit')}
                      </Button>
                    ) : (
                      field.locked && <span className={lockStyle}>{field.locked}</span>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {profile && <AccountManagement user={profile} onUpdated={onUpdated} />}
    </Stack>
  );
}

const labelStyle = css({ fontWeight: 500 });
const lockStyle = css({ fontStyle: 'italic', marginRight: '0.6rem' });
