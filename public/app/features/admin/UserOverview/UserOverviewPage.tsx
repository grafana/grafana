import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useParams, useSearchParams } from 'react-router-dom-v5-compat';

import { type Team, type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Stack, Tab, TabsBar, Text, TextLink, useStyles2 } from '@grafana/ui';
import { useListUserRolesQuery } from 'app/api/clients/roles';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { UserSortableHeader, useUserTableSort } from '../UserTableSorting';

import { UserDetails } from './UserDetails';
import { OrganizationsTab, SessionsTab, AuthenticationTab, UserRolesEditor } from './UserManagement';
import {
  type RoleAssignment,
  type OverviewProfile,
  useGetOverviewProfileQuery,
  useGetOverviewUserQuery,
  useGetOverviewOrgUsersQuery,
  useGetOverviewTeamRolesQuery,
  useGetOverviewTeamsQuery,
} from './api';

export default function UserOverviewPage() {
  const styles = useStyles2(getStyles);
  const { id: uid = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'details';
  const overview = useGetOverviewUserQuery(uid);
  const canReadProfile = contextSrv.hasPermission(AccessControlAction.UsersRead);
  const profileQuery = useGetOverviewProfileQuery(canReadProfile ? uid : skipToken);
  const profile = profileQuery.currentData;
  const user = overview.currentData?.user;
  const onUpdated = () => {
    if (canReadProfile) {
      profileQuery.refetch();
    }
    overview.refetch();
  };
  const canReadSessions = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList);
  const showOrganizations = profile && contextSrv.hasPermission(AccessControlAction.OrgsRead);
  const showAuthentication =
    profile?.isExternal &&
    profile.isExternallySynced &&
    profile.authLabels?.includes('LDAP') &&
    featureEnabled('ldapsync') &&
    contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
  const tabs = [
    { id: 'details', label: t('admin.user-overview.details', 'User details') },
    { id: 'teams', label: t('admin.user-overview.teams', 'Teams') },
    { id: 'roles', label: t('admin.user-overview.roles', 'Roles') },
    ...(showOrganizations
      ? [{ id: 'organizations', label: t('admin.user-overview.organizations', 'Organizations') }]
      : []),
    ...(canReadSessions ? [{ id: 'sessions', label: t('admin.user-overview.sessions', 'Sessions') }] : []),
    ...(showAuthentication
      ? [{ id: 'authentication', label: t('admin.user-overview.authentication', 'Authentication') }]
      : []),
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
      <TabsBar className={styles.tabs}>
        {tabs.map(({ id, label }) => (
          <Tab key={id} label={label} active={active === id} onChangeTab={() => setParams({ tab: id })} />
        ))}
      </TabsBar>
      <Page.Contents isLoading={!user && (overview.isFetching || profileQuery.isFetching)}>
        {!user && (overview.error || profileQuery.error) ? (
          <LoadError error={overview.error || profileQuery.error} />
        ) : (
          user && (
            <>
              {active === 'details' && (
                <Stack direction="column" gap={3}>
                  <UserDetails
                    key={uid}
                    user={user}
                    profile={profile}
                    hasLastSeen={!!overview.currentData?.hasLastSeen}
                    onUpdated={onUpdated}
                  />
                  {Boolean(profileQuery.error) && <LoadError error={profileQuery.error} />}
                </Stack>
              )}
              {active === 'teams' && <UserTeams uid={uid} />}
              {active === 'roles' && <UserRoles user={user} profile={profile} onUpdated={onUpdated} />}
              {active === 'organizations' && profile && <OrganizationsTab user={profile} onUpdated={onUpdated} />}
              {active === 'sessions' && <SessionsTab uid={uid} />}
              {active === 'authentication' && profile && <AuthenticationTab user={profile} onUpdated={onUpdated} />}
            </>
          )
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabs: css({ marginBottom: theme.spacing(3) }),
});

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

function TeamLink({ team }: { team: Team }) {
  return (
    <TextLink color="primary" inline={false} href={`/org/teams/edit/${team.metadata.name}`}>
      {team.spec.title}
    </TextLink>
  );
}

function UserTeams({ uid }: { uid: string }) {
  const { currentData: teams, isFetching: isLoading, error } = useGetOverviewTeamsQuery(uid);
  const { sortedRows, headerProps } = useUserTableSort(teams ?? [], {
    name: (team) => team.spec.title,
    email: (team) => team.spec.email || '',
  });
  if (isLoading) {
    return <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>;
  }
  if (error) {
    return <LoadError error={error} />;
  }
  return teams?.length ? (
    <table className="filter-table form-inline">
      <thead>
        <tr>
          <UserSortableHeader {...headerProps('name')}>
            {t('admin.user-overview.team-name', 'Team name')}
          </UserSortableHeader>
          <UserSortableHeader {...headerProps('email')}>{t('admin.user-overview.email', 'Email')}</UserSortableHeader>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((team) => (
          <tr key={team.metadata.name}>
            <td>
              <TeamLink team={team} />
            </td>
            <td>{team.spec.email || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <Text color="secondary">
      {t('admin.user-overview.no-teams', 'This user does not belong to any teams in the current organization.')}
    </Text>
  );
}

function UserRoles({ user, profile, onUpdated }: { user: User; profile?: OverviewProfile; onUpdated: () => void }) {
  const orgUsers = useGetOverviewOrgUsersQuery(
    contextSrv.hasPermission(AccessControlAction.OrgUsersRead) ? user.spec.login : skipToken
  );
  const orgUser = orgUsers.currentData?.find((member) => member.uid === user.metadata.name);
  const editableUser = orgUser
    ? {
        id: orgUser.userId,
        uid: orgUser.uid,
        isExternallySynced: orgUser.isExternallySynced,
        isProvisioned: orgUser.isProvisioned,
      }
    : profile;
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
    role:
      (orgUser?.role ?? user.spec.role) === 'None'
        ? t('admin.user-overview.no-basic-role', 'No basic role')
        : (orgUser?.role ?? user.spec.role),
    type: 'direct',
  };
  const assignments: RoleAssignment[] = [
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
  ];
  const assignmentType = (assignment: RoleAssignment) =>
    assignment.id === 'basic'
      ? t('admin.user-overview.basic', 'Basic role')
      : assignment.type === 'team'
        ? t('admin.user-overview.inherited', 'Inherited from team')
        : t('admin.user-overview.direct', 'Directly assigned');
  const assignmentSource = (assignment: RoleAssignment) =>
    assignment.team?.spec.title ??
    (assignment.id === 'basic' ? t('admin.user-overview.default', 'Default basic role') : user.spec.login);
  const { sortedRows, headerProps } = useUserTableSort(assignments, {
    role: (assignment) => assignment.role,
    type: assignmentType,
    source: assignmentSource,
  });
  return (
    <Stack direction="column" gap={2}>
      {editableUser && (
        <UserRolesEditor
          user={editableUser}
          basicRole={orgUser?.role ?? user.spec.role}
          onUpdated={() => {
            if (orgUsers.currentData) {
              orgUsers.refetch();
            }
            onUpdated();
          }}
        />
      )}
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
      <table className="filter-table form-inline">
        <thead>
          <tr>
            <UserSortableHeader {...headerProps('role')}>{t('admin.user-overview.role', 'Role')}</UserSortableHeader>
            <UserSortableHeader {...headerProps('type')}>
              {t('admin.user-overview.assignment', 'Assignment type')}
            </UserSortableHeader>
            <UserSortableHeader {...headerProps('source')}>
              {t('admin.user-overview.source', 'Source')}
            </UserSortableHeader>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((assignment) => (
            <tr key={assignment.id}>
              <td>
                <Stack direction="column" gap={0}>
                  <Text>{assignment.role}</Text>
                  {assignment.description && <Text color="secondary">{assignment.description}</Text>}
                </Stack>
              </td>
              <td>{assignmentType(assignment)}</td>
              <td>{assignment.team ? <TeamLink team={assignment.team} /> : assignmentSource(assignment)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
}
