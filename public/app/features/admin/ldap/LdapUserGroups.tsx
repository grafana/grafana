import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Tooltip, Icon, InteractiveTable, type CellProps, Column, Stack } from '@grafana/ui';
import { LdapRole } from 'app/types/ldap';

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
            <Stack alignItems="center" wrap>
              <Trans i18nKey="admin.ldap-user-groups.no-org-found">No match</Trans>
              <Tooltip
                content={t(
                  'admin.ldap-user-groups.columns.content-no-matching-organizations-found',
                  'No matching organizations found'
                )}
              >
                <Icon name="info-circle" />
              </Tooltip>
            </Stack>
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
