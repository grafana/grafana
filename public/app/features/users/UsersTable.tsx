import React, { SFC } from 'react';
import { User } from 'app/types';

export interface Props {
  users: User[];
  onRoleChange: (value: string) => {};
}

const UsersTable: SFC<Props> = props => {
  const { users } = props;

  return (
    <div>
      Le Table
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
                    onChange={event => props.onRoleChange(event.target.value)}
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
                <div onClick={() => props.removeUser(user)} className="btn btn-danger btn-mini">
                  <i className="fa fa-remove" />
                </div>
              </td>
            </tr>
          );
        })}
      </table>
    </div>
  );
};

export default UsersTable;
