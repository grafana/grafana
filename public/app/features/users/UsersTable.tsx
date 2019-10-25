import React, { FC } from 'react';
import { OrgUser } from 'app/types';

export interface Props {
  users: OrgUser[];
  onRoleChange: (role: string, user: OrgUser) => void;
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
          <th>Seen</th>
          <th>Role</th>
          <th style={{ width: '34px' }} />
        </tr>
      </thead>
      <tbody>
        {users.map((user, index) => {
          return (
            <tr key={`${user.userId}-${index}`}>
              <td className="width-4 text-center">
                <img className="filter-table__avatar" src={user.avatarUrl} />
              </td>
              <td>{user.login}</td>
              <td>
                <span className="ellipsis">{user.email}</span>
              </td>
              <td>{user.lastSeenAtAge}</td>
              <td>
                <div className="gf-form-select-wrapper width-12">
                  <select
                    value={user.role}
                    className="gf-form-input"
                    onChange={event => onRoleChange(event.target.value, user)}
                  >
                    {['Viewer', 'Editor', 'Admin'].map((option, index) => {
                      return (
                        <option value={option} key={`${option}-${index}`}>
                          {option}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </td>
              <td>
                <div onClick={() => onRemoveUser(user)} className="btn btn-danger btn-small">
                  <i className="fa fa-remove" />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default UsersTable;
