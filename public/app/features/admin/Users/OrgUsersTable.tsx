import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Button, ConfirmModal, Icon, Tooltip, CellProps, useStyles2, Tag, InteractiveTable } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgUser, Role } from 'app/types';

import { OrgRolePicker } from '../OrgRolePicker';

import { Avatar } from './Avatar';
import { createSortFn } from './sort';

type Cell<T extends keyof OrgUser = keyof OrgUser> = CellProps<OrgUser, OrgUser[T]>;

const disabledRoleMessage = `This user's role is not editable because it is synchronized from your auth provider.
  Refer to the Grafana authentication docs for details.`;

const getBasicRoleDisabled = (user: OrgUser) => {
  let basicRoleDisabled = !contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersWrite, user);
  let authLabel = Array.isArray(user.authLabels) && user.authLabels.length > 0 ? user.authLabels[0] : '';
  // A GCom specific feature toggle for role locking has been introduced, as the previous implementation had a bug with locking down external users synced through GCom (https://github.com/grafana/grafana/pull/72044)
  // Remove this conditional once FlagGcomOnlyExternalOrgRoleSync feature toggle has been removed
  if (authLabel !== 'grafana.com' || config.featureToggles.gcomOnlyExternalOrgRoleSync) {
    const isUserSynced = user?.isExternallySynced;
    basicRoleDisabled = isUserSynced || basicRoleDisabled;
  }

  return basicRoleDisabled;
};

export interface Props {
  users: OrgUser[];
  orgId?: number;
  onRoleChange: (role: OrgRole, user: OrgUser) => void;
  onRemoveUser: (user: OrgUser) => void;
}

export const OrgUsersTable = ({ users, orgId, onRoleChange, onRemoveUser }: Props) => {
  const [userToRemove, setUserToRemove] = useState<OrgUser | null>(null);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(orgId);
          setRoleOptions(options);
        }
      } catch (e) {
        console.error('Error loading options');
      }
    }
    if (contextSrv.licensedAccessControlEnabled()) {
      fetchOptions();
    }
  }, [orgId]);

  const columns = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => <Avatar src={value} alt="User avatar" />,
      },
      {
        id: 'login',
        header: 'Login',
        cell: ({ cell: { value } }: Cell<'login'>) => <div>{value}</div>,
        sortType: createSortFn<OrgUser>('login'),
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ cell: { value } }: Cell<'email'>) => value,
        sortType: createSortFn<OrgUser>('email'),
      },
      {
        id: 'name',
        header: 'Name',
        cell: ({ cell: { value } }: Cell<'name'>) => value,
        sortType: createSortFn<OrgUser>('name'),
      },
      {
        id: 'lastSeenAtAge',
        header: 'Last active',
        cell: ({ cell: { value } }: Cell<'lastSeenAtAge'>) => value,
        sortType: createSortFn<OrgUser>('lastSeenAt'),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ cell: { value }, row: { original } }: Cell<'role'>) => {
          const basicRoleDisabled = getBasicRoleDisabled(original);
          return contextSrv.licensedAccessControlEnabled() ? (
            <UserRolePicker
              userId={original.userId}
              orgId={orgId}
              roleOptions={roleOptions}
              basicRole={value}
              onBasicRoleChange={(newRole) => onRoleChange(newRole, original)}
              basicRoleDisabled={basicRoleDisabled}
              basicRoleDisabledMessage={disabledRoleMessage}
            />
          ) : (
            <OrgRolePicker
              aria-label="Role"
              value={value}
              disabled={basicRoleDisabled}
              onChange={(newRole) => onRoleChange(newRole, original)}
            />
          );
        },
      },
      {
        id: 'info',
        header: '',
        cell: InfoCell,
      },
      {
        id: 'authLabels',
        header: 'Origin',
        cell: ({ cell: { value } }: Cell<'authLabels'>) => (
          <>{Array.isArray(value) && value.length > 0 && <TagBadge label={value[0]} removeIcon={false} count={0} />}</>
        ),
      },
      {
        id: 'isDisabled',
        header: '',
        cell: ({ cell: { value } }: Cell<'isDisabled'>) => <>{value && <Tag colorIndex={9} name={'Disabled'} />}</>,
        sortType: createSortFn<OrgUser>('isDisabled'),
      },
      {
        id: 'delete',
        header: '',
        cell: ({ row: { original } }: Cell) => {
          return (
            contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRemove, original) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setUserToRemove(original);
                }}
                icon="times"
                aria-label={`Delete user ${original.name}`}
              />
            )
          );
        },
      },
    ],
    [orgId, roleOptions, onRoleChange]
  );

  return (
    <>
      <InteractiveTable columns={columns} data={users} getRowId={(user) => String(user.userId)} />
      {Boolean(userToRemove) && (
        <ConfirmModal
          body={`Are you sure you want to delete user ${userToRemove?.login}?`}
          confirmText="Delete"
          title="Delete"
          onDismiss={() => {
            setUserToRemove(null);
          }}
          isOpen={true}
          onConfirm={() => {
            if (!userToRemove) {
              return;
            }
            onRemoveUser(userToRemove);
            setUserToRemove(null);
          }}
        />
      )}
    </>
  );
};

const InfoCell = ({ row: { original } }: Cell) => {
  const styles = useStyles2(getStyles);
  const basicRoleDisabled = getBasicRoleDisabled(original);
  return (
    basicRoleDisabled && (
      <div className={styles.row}>
        <Tooltip content={disabledRoleMessage}>
          <Icon name="question-circle" className={styles.icon} />
        </Tooltip>
      </div>
    )
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css`
    display: flex;
    align-items: center;
  `,
  icon: css`
    margin-left: ${theme.spacing(1)};
  `,
});
