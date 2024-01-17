import React from 'react';

import { Tooltip, Icon, InteractiveTable, type CellProps } from '@grafana/ui';
import { LdapRole } from 'app/types';

interface Props {
  groups: LdapRole[];
  showAttributeMapping?: boolean;
}

export const LdapUserGroups = ({ groups, showAttributeMapping }: Props) => {
  const items = showAttributeMapping ? groups : groups.filter((item) => item.orgRole);
  const columns = [
    {
      id: 'groupDN',
      header: 'LDAP Group',
      visible: () => showAttributeMapping || false,
    },
    {
      id: 'orgName',
      header: 'Organization',
      cell: (props: CellProps<LdapRole, string | undefined>) =>
        props.value && props.row.original.orgRole ? props.value : '',
    },
    {
      id: 'orgRole',
      header: 'Role',
      cell: (props: CellProps<LdapRole, string | undefined>) =>
        props.value || (
          <>
            No match{' '}
            <Tooltip content="No matching organizations found">
              <Icon name="info-circle" />
            </Tooltip>
          </>
        ),
    },
  ];

  return (
    <InteractiveTable
      headerTooltips={{
        orgName: { content: 'Only the first match for an Organization will be used', iconName: 'info-circle' },
      }}
      columns={columns}
      data={items}
      getRowId={(row) => row.orgId + row.orgRole}
    />
  );

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
