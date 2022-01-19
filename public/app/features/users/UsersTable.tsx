import React, { FC, useEffect, useState } from 'react';
import { AccessControlAction, OrgUser, Role } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { Button, ConfirmModal } from '@grafana/ui';
import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { fetchBuiltinRoles, fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';

export interface Props {
  users: OrgUser[];
  orgId?: number;
  onRoleChange: (role: OrgRole, user: OrgUser) => void;
  onRemoveUser: (user: OrgUser) => void;
}

const UsersTable: FC<Props> = (props) => {
  const { users, orgId, onRoleChange, onRemoveUser } = props;
  const [userToRemove, setUserToRemove] = useState<OrgUser | null>(null);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<{ [key: string]: Role[] }>({});

  useEffect(() => {
    async function fetchOptions() {
      try {
        if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
          let options = await fetchRoleOptions(orgId);
          setRoleOptions(options);
        } else {
          setRoleOptions([]);
        }

        if (contextSrv.hasPermission(AccessControlAction.ActionBuiltinRolesList)) {
          const builtInRoles = await fetchBuiltinRoles(orgId);
          setBuiltinRoles(builtInRoles);
        } else {
          setBuiltinRoles({});
        }
      } catch (e) {
        console.error('Error loading options');
      }
    }
    if (contextSrv.accessControlEnabled()) {
      fetchOptions();
    }
  }, [orgId]);

  const getRoleOptions = async () => roleOptions;
  const getBuiltinRoles = async () => builtinRoles;

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
            <th style={{ width: '34px' }} />
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => {
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
                  {contextSrv.accessControlEnabled() ? (
                    <UserRolePicker
                      userId={user.userId}
                      orgId={orgId}
                      builtInRole={user.role}
                      onBuiltinRoleChange={(newRole) => onRoleChange(newRole, user)}
                      getRoleOptions={getRoleOptions}
                      getBuiltinRoles={getBuiltinRoles}
                      disabled={!contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRoleUpdate, user)}
                    />
                  ) : (
                    <OrgRolePicker
                      aria-label="Role"
                      value={user.role}
                      disabled={!contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRoleUpdate, user)}
                      onChange={(newRole) => onRoleChange(newRole, user)}
                    />
                  )}
                </td>

                {contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRemove, user) && (
                  <td>
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

export default UsersTable;
