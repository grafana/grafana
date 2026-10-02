import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useParams, useSearchParams } from 'react-router-dom-v5-compat';

import { useGetUserQuery, type Team, type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, type Column, InteractiveTable, Stack, Tab, TabsBar, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useGetUserByIdQuery } from 'app/api/clients/legacy';
import { useListUserRolesQuery } from 'app/api/clients/roles';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { type RoleAssignment, useGetOverviewTeamRolesQuery, useGetOverviewTeamsQuery } from './api';

export default function UserOverviewPage() {
  const { uid = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'details';
  const { currentData: user, isFetching, error } = useGetUserQuery({ name: uid });
  const userId = Number(user?.metadata.labels?.['grafana.app/deprecatedInternalID']);
  const { currentData: profile } = useGetUserByIdQuery(
    userId > 0 && contextSrv.hasPermission(AccessControlAction.UsersRead) ? { userId } : skipToken
  );
  const tabs = [
    { id: 'details', label: t('admin.user-overview.details', 'User details') },
    { id: 'teams', label: t('admin.user-overview.teams', 'Teams') },
    { id: 'roles', label: t('admin.user-overview.roles', 'Roles') },
  ];
  const active = tabs.some(({ id }) => id === tab) ? tab : 'details';

  return (
    <Page
      navId="global-users"
      pageNav={{
        text: user?.spec.login || t('admin.user-overview.title', 'User'),
        subTitle: user?.spec.email,
        img: profile?.avatarUrl,
      }}
    >
      <TabsBar>
        {tabs.map(({ id, label }) => (
          <Tab key={id} label={label} active={active === id} onChangeTab={() => setParams({ tab: id })} />
        ))}
      </TabsBar>
      <Page.Contents isLoading={isFetching}>
        {error ? (
          <LoadError error={error} />
        ) : (
          user && (
            <>
              {active === 'details' && <UserDetails user={user} authLabels={profile?.authLabels} />}
              {active === 'teams' && <UserTeams uid={uid} />}
              {active === 'roles' && <UserRoles user={user} />}
            </>
          )
        )}
      </Page.Contents>
    </Page>
  );
}

function LoadError({ error }: { error: unknown }) {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  return (
    <Alert
      severity="warning"
      title={
        status === 403
          ? t('admin.user-overview.forbidden', 'You do not have permission to view this information')
          : status === 404
            ? t('admin.user-overview.not-found', 'This information is not available')
            : t('admin.user-overview.load-error', 'Unable to load this information. Please try again.')
      }
    />
  );
}

function UserDetails({ user, authLabels }: { user: User; authLabels?: string[] }) {
  const styles = useStyles2(getStyles);
  const origins = authLabels ?? user.spec.externalAuthInfo?.map((auth) => auth.module);
  const yes = t('admin.user-overview.yes', 'Yes');
  const no = t('admin.user-overview.no', 'No');
  const created = user.metadata.creationTimestamp;
  const lastSeen = user.status?.lastSeenAt ? user.status.lastSeenAt * 1000 : 0;
  const never = !lastSeen || (created && lastSeen < new Date(created).getTime());
  const fields: Array<[string, string | undefined]> = [
    [t('admin.user-overview.login', 'Login'), user.spec.login],
    [t('admin.user-overview.name', 'Name'), user.spec.title],
    [t('admin.user-overview.email', 'Email'), user.spec.email],
    [
      t('admin.user-overview.origin', 'Origin'),
      origins ? [...new Set(origins)].join(', ') || t('admin.user-overview.local', 'Grafana') : undefined,
    ],
    [t('admin.user-overview.provisioned', 'Provisioned'), user.spec.provisioned ? yes : no],
    [
      t('admin.user-overview.status', 'Status'),
      user.spec.disabled ? t('admin.user-overview.disabled', 'Disabled') : t('admin.user-overview.enabled', 'Enabled'),
    ],
    [t('admin.user-overview.created', 'Created'), created ? dateTimeFormat(created) : undefined],
    [
      t('admin.user-overview.last-active', 'Last active'),
      never
        ? t('admin.user-overview.never', 'Never')
        : `${dateTimeFormatTimeAgo(lastSeen)} (${dateTimeFormat(lastSeen)})`,
    ],
    [t('admin.user-overview.grafana-admin', 'Grafana admin'), user.spec.grafanaAdmin ? yes : no],
  ];
  return (
    <dl className={styles.details}>
      {fields.map(([label, value]) => (
        <div className={styles.field} key={label}>
          <dt>
            <Text color="secondary">{label}</Text>
          </dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function TeamLink({ team }: { team: Team }) {
  return <TextLink href={`/org/teams/edit/${team.metadata.name}`}>{team.spec.title}</TextLink>;
}

function UserTeams({ uid }: { uid: string }) {
  const { currentData: teams, isFetching: isLoading, error } = useGetOverviewTeamsQuery(uid);
  const columns: Array<Column<Team>> = [
    {
      id: 'name',
      header: t('admin.user-overview.team-name', 'Team name'),
      cell: ({ row }) => <TeamLink team={row.original} />,
    },
    { id: 'email', header: t('admin.user-overview.email', 'Email'), cell: ({ row }) => row.original.spec.email || '—' },
  ];
  if (isLoading) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  if (error) {
    return <LoadError error={error} />;
  }
  return teams?.length ? (
    <InteractiveTable columns={columns} data={teams} getRowId={(team) => team.metadata.name!} />
  ) : (
    <Text color="secondary">
      {t('admin.user-overview.no-teams', 'This user does not belong to any teams in the current organization.')}
    </Text>
  );
}

function UserRoles({ user }: { user: User }) {
  const licensed = contextSrv.licensedAccessControlEnabled();
  const canReadUserRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
  const canReadTeamRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);
  const teams = useGetOverviewTeamsQuery(licensed && canReadTeamRoles ? user.metadata.name! : skipToken);
  const userId = Number(user.metadata.labels?.['grafana.app/deprecatedInternalID']);
  const directRoles = useListUserRolesQuery(
    licensed && canReadUserRoles && userId > 0
      ? { userId, targetOrgId: contextSrv.user.orgId, includeMapped: true }
      : skipToken
  );
  const roles = useGetOverviewTeamRolesQuery(
    licensed && canReadTeamRoles && teams.currentData
      ? { teams: teams.currentData, orgId: contextSrv.user.orgId! }
      : skipToken
  );
  const basic: RoleAssignment = {
    id: 'basic',
    role: user.spec.role === 'None' ? t('admin.user-overview.no-basic-role', 'No basic role') : user.spec.role,
    type: 'direct',
  };
  const columns: Array<Column<RoleAssignment>> = [
    {
      id: 'role',
      header: t('admin.user-overview.role', 'Role'),
      cell: ({ row }) => (
        <Stack direction="column" gap={0}>
          <Text>{row.original.role}</Text>
          {row.original.description && <Text color="secondary">{row.original.description}</Text>}
        </Stack>
      ),
    },
    {
      id: 'type',
      header: t('admin.user-overview.assignment', 'Assignment type'),
      cell: ({ row }) =>
        row.original.id === 'basic'
          ? t('admin.user-overview.basic', 'Basic role')
          : row.original.type === 'team'
            ? t('admin.user-overview.inherited', 'Inherited from team')
            : t('admin.user-overview.direct', 'Directly assigned'),
    },
    {
      id: 'source',
      header: t('admin.user-overview.source', 'Source'),
      cell: ({ row }) =>
        row.original.team ? (
          <TeamLink team={row.original.team} />
        ) : row.original.id === 'basic' ? (
          t('admin.user-overview.default', 'Default basic role')
        ) : (
          user.spec.login
        ),
    },
  ];
  return (
    <Stack direction="column" gap={2}>
      {licensed && (!canReadUserRoles || !canReadTeamRoles) && <LoadError error={{ status: 403 }} />}
      {Boolean(teams.error || roles.error || directRoles.error) && (
        <LoadError error={teams.error || roles.error || directRoles.error} />
      )}
      {licensed && canReadUserRoles && !userId && <LoadError error={{ status: 404 }} />}
      {!!roles.currentData?.unavailableTeams.length && (
        <Alert severity="warning" title={t('admin.user-overview.partial-roles', 'Some team roles could not be loaded')}>
          {roles.currentData.unavailableTeams.join(', ')}
        </Alert>
      )}
      {(teams.isFetching || roles.isFetching || directRoles.isFetching) && (
        <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>
      )}
      <InteractiveTable
        columns={columns}
        data={[
          ...(basic.role ? [basic] : []),
          ...(directRoles.currentData ?? []).map(
            (role): RoleAssignment => ({
              id: `direct:${role.uid}`,
              role: role.displayName || role.name,
              description: role.description,
              type: 'direct',
            })
          ),
          ...(roles.currentData?.assignments ?? []),
        ]}
        getRowId={(role) => role.id}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  details: css({ margin: 0, maxWidth: 800 }),
  field: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 180px) 1fr',
    gap: theme.spacing(3),
    padding: theme.spacing(2, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    dd: { margin: 0, overflowWrap: 'anywhere' },
  }),
});
