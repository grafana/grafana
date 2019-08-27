import React, { FC } from 'react';
import { LdapRole } from '../../types';

interface Props {
  groups: LdapRole[];
  className: string;
}

export const LdapUserGroups: FC<Props> = ({ className, groups }) => {
  return (
    <table className={`${className} filter-table form-inline`}>
      <thead>
        <tr>
          <th>Organisation</th>
          <th>Role</th>
          <th>LDAP Group</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, index) => {
          return (
            <tr key={`${group.orgId}-${index}`}>
              <td className="width-16">{group.orgId}</td>
              <td className="width-14">{group.orgRole}</td>
              <td>{group.ldapAttribute}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
