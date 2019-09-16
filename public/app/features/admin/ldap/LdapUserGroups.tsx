import React, { FC } from 'react';
import { Tooltip } from '@grafana/ui';
import { LdapRole } from '../../../types';

interface Props {
  groups: LdapRole[];
  className: string;
  showAttributeMapping?: boolean;
}

export const LdapUserGroups: FC<Props> = ({ className, groups, showAttributeMapping }) => {
  const items = showAttributeMapping ? groups : groups.filter(item => item.orgRole);
  const roleColumnClass = showAttributeMapping && 'width-14';

  return (
    <table className={`${className} filter-table form-inline`}>
      <thead>
        <tr>
          <th>Organisation</th>
          <th>Role</th>
          {showAttributeMapping && <th colSpan={2}>LDAP Group</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((group, index) => {
          return (
            <tr key={`${group.orgId}-${index}`}>
              <td className="width-16">{group.orgName}</td>
              <td className={roleColumnClass}>{group.orgRole}</td>
              {showAttributeMapping && (
                <>
                  <td>{group.groupDN}</td>
                  <td>
                    {!group.orgRole && (
                      <span className="text-warning pull-right">
                        No match
                        <Tooltip placement="top" content="No matching groups found" theme={'info'}>
                          <div className="gf-form-help-icon gf-form-help-icon--right-normal">
                            <i className="fa fa-info-circle" />
                          </div>
                        </Tooltip>
                      </span>
                    )}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
