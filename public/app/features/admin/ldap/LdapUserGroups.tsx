import React from 'react';

import { Tooltip, Icon } from '@grafana/ui';
import { LdapRole } from 'app/types';

interface Props {
  groups: LdapRole[];
  showAttributeMapping?: boolean;
}

export const LdapUserGroups = ({ groups, showAttributeMapping }: Props) => {
  const items = showAttributeMapping ? groups : groups.filter((item) => item.orgRole);

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <table className="filter-table form-inline">
          <thead>
            <tr>
              {showAttributeMapping && <th>LDAP Group</th>}
              <th>
                Organization
                <Tooltip placement="top" content="Only the first match for an Organization will be used" theme={'info'}>
                  <Icon name="info-circle" />
                </Tooltip>
              </th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {items.map((group, index) => {
              return (
                <tr key={`${group.orgId}-${index}`}>
                  {showAttributeMapping && <td>{group.groupDN}</td>}
                  {group.orgName && group.orgRole ? <td>{group.orgName}</td> : <td />}
                  {group.orgRole ? (
                    <td>{group.orgRole}</td>
                  ) : (
                    <td>
                      <span className="text-warning">No match</span>
                      <Tooltip placement="top" content="No matching groups found" theme={'info'}>
                        <Icon name="info-circle" />
                      </Tooltip>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
