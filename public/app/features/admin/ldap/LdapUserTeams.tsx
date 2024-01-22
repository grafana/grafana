import React, { useMemo } from 'react';

import { Column, InteractiveTable, CellProps } from '@grafana/ui';
import { LdapTeam } from 'app/types';

interface Props {
  teams: LdapTeam[];
  showAttributeMapping?: boolean;
}

export const LdapUserTeams = ({ teams, showAttributeMapping }: Props) => {
  const items = showAttributeMapping ? teams : teams.filter((item) => item.teamName);

  const columns = useMemo<Array<Column<LdapTeam>>>(
    () => [
      {
        id: 'groupDN',
        header: 'LDAP Group',
        visible: () => !!showAttributeMapping,
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
    [showAttributeMapping]
  );

  return <InteractiveTable data={items} columns={columns} getRowId={(row) => row.teamName} />;
};
