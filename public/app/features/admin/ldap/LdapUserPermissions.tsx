import React, { useMemo } from 'react';

import { Column, Icon, InteractiveTable } from '@grafana/ui';
import { LdapPermissions } from 'app/types';

interface Props {
  permissions: LdapPermissions;
}

interface TableRow {
  permission: string;
  value: React.ReactNode;
}

export const LdapUserPermissions = ({ permissions }: Props) => {
  const columns = useMemo<Array<Column<TableRow>>>(
    () => [
      {
        id: 'permission',
        header: 'Permissions',
        disableGrow: true,
      },
      {
        id: 'value',
      },
    ],
    []
  );

  const data = useMemo<TableRow[]>(
    () => [
      {
        permission: 'Grafana admin',
        value: permissions.isGrafanaAdmin ? (
          <>
            <Icon name="shield" /> Yes
          </>
        ) : (
          'No'
        ),
      },
      {
        permission: 'Status',
        value: permissions.isDisabled ? (
          <>
            <Icon name="times" /> Inactive
          </>
        ) : (
          <>
            <Icon name="check" /> Active
          </>
        ),
      },
    ],
    [permissions]
  );

  return <InteractiveTable data={data} columns={columns} getRowId={(row) => row.permission} />;
};
