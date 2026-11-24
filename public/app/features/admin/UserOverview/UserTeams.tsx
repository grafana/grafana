import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type Column, EmptyState, InteractiveTable } from '@grafana/ui';

import { LoadState } from './LoadState';
import { TeamLink } from './TeamLink';
import { type UserTeam, useUserOverview, useUserTeams } from './hooks';

export function UserTeams({ uid }: { uid: string }) {
  const { user } = useUserOverview(uid);
  const { teams, error } = useUserTeams(user?.uid);
  const columns = useMemo<Array<Column<UserTeam>>>(
    () => [
      {
        id: 'name',
        header: t('admin.user-overview.team-name', 'Team name'),
        cell: ({ row: { original } }) => <TeamLink team={original} />,
        sortType: 'string',
      },
      {
        id: 'email',
        header: t('admin.user-overview.email', 'Email'),
        cell: ({ row: { original } }) => original.email || '—',
        sortType: 'string',
      },
    ],
    []
  );

  if (error || !teams) {
    return <LoadState error={error} />;
  }
  if (!teams.length) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t(
          'admin.user-overview.no-teams',
          'This user does not belong to any teams in the current organization.'
        )}
      />
    );
  }
  return <InteractiveTable columns={columns} data={teams} getRowId={(team) => team.uid} />;
}
