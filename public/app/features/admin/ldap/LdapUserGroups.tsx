import React, { useMemo } from 'react';

import { Tooltip, Icon, InteractiveTable, type CellProps, Column } from '@grafana/ui';
import { LdapRole } from 'app/types';

interface Props {
  groups: LdapRole[];
}

export const LdapUserGroups = ({ groups }: Props) => {
  const items = useMemo(() => groups, [groups]);

  const columns = useMemo<Array<Column<LdapRole>>>(
    () => [
      {
        id: 'groupDN',
        header: 'LDAP Group',
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
    ],
    []
  );

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
};
