import { useLocation, useParams, useSearchParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AuthenticationTab } from './AuthenticationTab';
import { LoadError } from './LoadError';
import { OrganizationsTab } from './OrganizationsTab';
import { SessionsTab } from './SessionsTab';
import { UserDetails } from './UserDetails';
import { UserRoles } from './UserRoles';
import { UserTeams } from './UserTeams';
import { useUserOverview, type UserSection } from './api';

export default function UserOverviewPage() {
  const { pathname } = useLocation();
  const { id: uid = '' } = useParams();
  const [params] = useSearchParams();
  const tab = params.get('tab') ?? 'details';
  const { account, membership } = useUserOverview(uid);
  const profile = account.data;
  const user = profile ?? membership.data;
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
        text: user?.login || t('admin.user-overview.title', 'User'),
        subTitle: user?.email,
        img: profile?.avatarUrl,
        children: user
          ? tabs.map(({ id, label }) => ({
              text: label,
              url: `${pathname}?tab=${id}`,
              active: active === id,
            }))
          : [],
      }}
    >
      <Page.Contents isLoading={!user && (account.isLoading || membership.isLoading)}>
        {!user ? (
          account.error || membership.error ? (
            <LoadError error={account.error || membership.error} />
          ) : (
            <Alert severity="warning" title={t('admin.user-overview.not-found', 'This information is not available')} />
          )
        ) : (
          <>
            {active === 'details' && (
              <Stack direction="column" gap={3}>
                <UserDetails key={uid} user={user} account={profile} membership={membership.data} />
                <SectionStatus section={account} />
                <SectionStatus section={membership} />
              </Stack>
            )}
            {active === 'teams' && <UserTeams uid={uid} />}
            {active === 'roles' && (
              <Stack direction="column" gap={2}>
                <SectionStatus section={membership} />
                <UserRoles user={user} membership={membership.data} />
                {!membership.data && !membership.isLoading && !membership.error && (
                  <Alert
                    severity="warning"
                    title={t('admin.user-overview.not-found', 'This information is not available')}
                  />
                )}
              </Stack>
            )}
            {active === 'organizations' && profile && <OrganizationsTab user={profile} />}
            {active === 'sessions' && <SessionsTab uid={uid} />}
            {active === 'authentication' && profile && <AuthenticationTab user={profile} />}
          </>
        )}
      </Page.Contents>
    </Page>
  );
}

function SectionStatus({ section }: { section: UserSection<unknown> }) {
  return (
    <>
      {section.isLoading && <Text>{t('admin.user-overview.loading', 'Loading…')}</Text>}
      {Boolean(section.error) && <LoadError error={section.error} />}
    </>
  );
}
