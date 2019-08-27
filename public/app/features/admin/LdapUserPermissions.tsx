import React, { FC } from 'react';
import { LdapPermissions } from 'app/types';

interface Props {
  permissions: LdapPermissions;
  className: string;
}

export const LdapUserPermissions: FC<Props> = ({ className, permissions }) => {
  return (
    <>
      <table className={`${className} filter-table form-inline`}>
        <thead>
          <tr>
            <th colSpan={1}>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Grafana admin</td>
            <td>{permissions.isGrafanaAdmin ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>{permissions.isDisabled ? 'Inactive' : 'Active'}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};
