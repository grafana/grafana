import { useMemo } from 'react';

import { type Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { t } from '@grafana/i18n';
import { type Column, Text } from '@grafana/ui';

import { LoadError } from './LoadError';
import { TeamLink } from './TeamLink';
import { UserTable } from './UserTable';
import { useGetOverviewTeamsQuery } from './api';

const collator = new Intl.Collator();

export function UserTeams({ uid }: { uid: string }) {
  const { currentData: teams, isFetching, error } = useGetOverviewTeamsQuery(uid);
  const columns = useMemo<Array<Column<Team>>>(
    () => [
      {
        id: 'name',
        header: t('admin.user-overview.team-name', 'Team name'),
        cell: ({ row: { original } }) => <TeamLink team={original} />,
        sortType: (a, b) => collator.compare(a.original.spec.title, b.original.spec.title),
      },
      {
        id: 'email',
        header: t('admin.user-overview.email', 'Email'),
        cell: ({ row: { original } }) => original.spec.email || '—',
        sortType: (a, b) => collator.compare(a.original.spec.email || '', b.original.spec.email || ''),
      },
    ],
    []
  );
  if (isFetching) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  if (error) {
    return <LoadError error={error} />;
  }
  return teams?.length ? (
    <UserTable data={teams} columns={columns} getRowId={(team) => team.metadata.name!} />
  ) : (
    <Text color="secondary">
      {t('admin.user-overview.no-teams', 'This user does not belong to any teams in the current organization.')}
    </Text>
  );
}
