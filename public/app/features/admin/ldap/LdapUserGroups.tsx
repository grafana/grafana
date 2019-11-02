import React, { FC } from 'react';
import { Tooltip } from '@grafana/ui';
import { LdapRole } from 'app/types';

interface Props {
  groups: LdapRole[];
  showAttributeMapping?: boolean;
}

export const LdapUserGroups: FC<Props> = ({ groups, showAttributeMapping }) => {
  const items = showAttributeMapping ? groups : groups.filter(item => item.orgRole);

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
                  <span className="gf-form-help-icon">
                    <i className="fa fa-info-circle" />
                  </span>
                </Tooltip>
              </th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {items.map((group, index) => {
              return (
                <tr key={`${group.orgId}-${index}`}>
                  {showAttributeMapping && (
                    <>
                      <td>{group.groupDN}</td>
                      {!group.orgRole && (
                        <>
                          <td />
                          <td>
                            <span className="text-warning">
                              No match
                              <Tooltip placement="top" content="No matching groups found" theme={'info'}>
                                <span className="gf-form-help-icon">
                                  <i className="fa fa-info-circle" />
                                </span>
                              </Tooltip>
                            </span>
                          </td>
                        </>
                      )}
                    </>
                  )}
                  {group.orgName && (
                    <>
                      <td>{group.orgName}</td>
                      <td>{group.orgRole}</td>
                    </>
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
