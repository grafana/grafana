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
          <th colSpan={2}>LDAP Group</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, index) => {
          return (
            <tr key={`${group.orgId}-${index}`}>
              <td className="width-16">{group.orgName}</td>
              <td className="width-14">{group.orgRole}</td>
              <td>{group.groupDN}</td>
              <td>{!group.orgRole && <span>No match</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
