import { useMemo } from 'react';

import { Tooltip, Icon, InteractiveTable, type CellProps, Column } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
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
              <Trans i18nKey="admin.ldap-user-groups.no-org-found">
                No match{' '}
                <Tooltip content="No matching organizations found">
                  <Icon name="info-circle" />
                </Tooltip>
              </Trans>
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
      getRowId={(row) => row.orgId + row.orgRole + row.groupDN}
    />
  );
};
