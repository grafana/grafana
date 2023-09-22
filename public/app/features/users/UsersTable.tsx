import React, { useEffect, useState } from 'react';

import { OrgRole } from '@grafana/data';
import { Button, ConfirmModal, Icon, Tooltip } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgUser, Role } from 'app/types';

import { OrgRolePicker } from '../admin/OrgRolePicker';

const disabledRoleMessage = `This user's role is not editable because it is synchronized from your auth provider.
  Refer to the Grafana authentication docs for details.`;

export interface Props {
  users: OrgUser[];
  orgId?: number;
  onRoleChange: (role: OrgRole, user: OrgUser) => void;
  onRemoveUser: (user: OrgUser) => void;
}

export const UsersTable = ({ users, orgId, onRoleChange, onRemoveUser }: Props) => {
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

  return (
    <>
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <th />
            <th>Login</th>
            <th>Email</th>
            <th>Name</th>
            <th>Seen</th>
            <th>Role</th>
            <th />
            <th style={{ width: '34px' }} />
            <th>Origin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => {
            let basicRoleDisabled = !contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersWrite, user);
            let authLabel = Array.isArray(user.authLabels) && user.authLabels.length > 0 ? user.authLabels[0] : '';
            // A GCom specific feature toggle for role locking has been introduced, as the previous implementation had a bug with locking down external users synced through GCom (https://github.com/grafana/grafana/pull/72044)
            // Remove this conditional once FlagGcomOnlyExternalOrgRoleSync feature toggle has been removed
            if (authLabel !== 'grafana.com' || config.featureToggles.gcomOnlyExternalOrgRoleSync) {
              const isUserSynced = user?.isExternallySynced;
              basicRoleDisabled = isUserSynced || basicRoleDisabled;
            }

            return (
              <tr key={`${user.userId}-${index}`}>
                <td className="width-2 text-center">
                  <img className="filter-table__avatar" src={user.avatarUrl} alt="User avatar" />
                </td>
                <td className="max-width-6">
                  <span className="ellipsis" title={user.login}>
                    {user.login}
                  </span>
                </td>

                <td className="max-width-5">
                  <span className="ellipsis" title={user.email}>
                    {user.email}
                  </span>
                </td>
                <td className="max-width-5">
                  <span className="ellipsis" title={user.name}>
                    {user.name}
                  </span>
                </td>
                <td className="width-1">{user.lastSeenAtAge}</td>

                <td className="width-8">
                  {contextSrv.licensedAccessControlEnabled() ? (
                    <UserRolePicker
                      userId={user.userId}
                      orgId={orgId}
                      roleOptions={roleOptions}
                      basicRole={user.role}
                      onBasicRoleChange={(newRole) => onRoleChange(newRole, user)}
                      basicRoleDisabled={basicRoleDisabled}
                      basicRoleDisabledMessage={disabledRoleMessage}
                    />
                  ) : (
                    <OrgRolePicker
                      aria-label="Role"
                      value={user.role}
                      disabled={basicRoleDisabled}
                      onChange={(newRole) => onRoleChange(newRole, user)}
                    />
                  )}
                </td>

                <td>
                  {basicRoleDisabled && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip content={disabledRoleMessage}>
                        <Icon name="question-circle" style={{ marginLeft: '8px' }} />
                      </Tooltip>
                    </div>
                  )}
                </td>

                <td className="width-1 text-center">
                  {user.isDisabled && <span className="label label-tag label-tag--gray">Disabled</span>}
                </td>

                <td className="width-1">
                  {Array.isArray(user.authLabels) && user.authLabels.length > 0 && (
                    <TagBadge label={user.authLabels[0]} removeIcon={false} count={0} />
                  )}
                </td>

                {contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRemove, user) && (
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setUserToRemove(user);
                      }}
                      icon="times"
                      aria-label="Delete user"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
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
