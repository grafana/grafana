import React, { FC, useState } from 'react';
import { OrgUser } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { ConfirmButton, Button, ConfirmModal } from '@grafana/ui';
import { OrgRole } from '@grafana/data';

export interface Props {
  users: OrgUser[];
  onRoleChange: (role: OrgRole, user: OrgUser) => void;
  onRemoveUser: (user: OrgUser) => void;
}

const UsersTable: FC<Props> = props => {
  const { users, onRoleChange, onRemoveUser } = props;

  return (
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
          const [isChangingRole, setIsChangingRole] = useState(false);
          const [role, setRole] = useState<OrgRole>(user.role);
          const [isRemovingUser, setIsRemovingUser] = useState(false);
          return (
            <tr key={`${user.userId}-${index}`}>
              <td className="width-4 text-center">
                <img className="filter-table__avatar" src={user.avatarUrl} />
              </td>
              <td>{user.login}</td>

              <td>
                <span className="ellipsis">{user.email}</span>
              </td>
              <td>{user.name}</td>
              <td>{user.lastSeenAtAge}</td>

              <td className="width-8">
                {!isChangingRole && role}
                {isChangingRole && <OrgRolePicker type="select" value={role} onChange={newRole => setRole(newRole)} />}
              </td>
              <td className="width-11">
                <ConfirmButton
                  closeOnConfirm
                  onClick={() => setIsChangingRole(true)}
                  onCancel={() => setIsChangingRole(false)}
                  onConfirm={() => {
                    onRoleChange(role, user);
                    setIsChangingRole(false);
                  }}
                >
                  Edit role
                </ConfirmButton>
              </td>
              <td>
                <Button size="sm" variant="destructive" onClick={() => setIsRemovingUser(true)} icon="fa fa-remove" />
                <ConfirmModal
                  body={`Are you sure you want to delete user ${user.login}?`}
                  confirmText="Delete"
                  title="Delete"
                  onDismiss={() => setIsRemovingUser(false)}
                  isOpen={isRemovingUser}
                  onConfirm={() => {
                    onRemoveUser(user);
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default UsersTable;
