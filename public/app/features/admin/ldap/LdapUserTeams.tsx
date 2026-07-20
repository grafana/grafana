import { useMemo } from 'react';

import { type Column, InteractiveTable, type CellProps } from '@grafana/ui';
import { type LdapTeam } from 'app/types/ldap';

interface Props {
  teams: LdapTeam[];
}

export const LdapUserTeams = ({ teams }: Props) => {
  const columns = useMemo<Array<Column<LdapTeam>>>(
    () => [
      {
        id: 'groupDN',
        header: 'LDAP Group',
      },
      {
        id: 'orgName',
        header: 'Organization',
        cell: ({
          row: {
            original: { orgName },
          },
        }: CellProps<LdapTeam, void>) => <>{orgName || 'No matching teams found'}</>,
      },
      {
        id: 'teamName',
        header: 'Team',
        cell: ({
          row: {
            original: { teamName, orgName },
          },
        }: CellProps<LdapTeam, void>) => (teamName && orgName ? teamName : ''),
      },
    ],
    []
  );

  return <InteractiveTable data={teams} columns={columns} getRowId={(row) => row.teamName} />;
};
