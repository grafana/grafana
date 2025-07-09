import { useMemo } from 'react';
import * as React from 'react';

import { Trans } from '@grafana/i18n';
import { Column, Icon, InteractiveTable } from '@grafana/ui';
import { LdapPermissions } from 'app/types/ldap';

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
          <Trans i18nKey="admin.ldap-permissions.admin">
            <Icon name="shield" /> Yes
          </Trans>
        ) : (
          'No'
        ),
      },
      {
        permission: 'Status',
        value: permissions.isDisabled ? (
          <Trans i18nKey="admin.ldap-permissions.inactive">
            <Icon name="times" /> Inactive
          </Trans>
        ) : (
          <Trans i18nKey="admin.ldap-permissions.active">
            <Icon name="check" /> Active
          </Trans>
        ),
      },
    ],
    [permissions]
  );

  return <InteractiveTable data={data} columns={columns} getRowId={(row) => row.permission} />;
};
