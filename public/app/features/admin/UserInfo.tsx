import React, { FC } from 'react';
import { User } from 'app/types';

interface Props {
  user: User;
  className: string;
}

export const UserInfo: FC<Props> = ({ className, user }) => {
  return (
    <>
      <table className={`${className} filter-table form-inline`}>
        <thead>
          <tr>
            <th colSpan={2}>User information</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="width-16">Name</td>
            <td>{user.name}</td>
          </tr>
          <tr>
            <td className="width-16">Username</td>
            <td>{user.login}</td>
          </tr>
          <tr>
            <td className="width-16">Email</td>
            <td>{user.email}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};
