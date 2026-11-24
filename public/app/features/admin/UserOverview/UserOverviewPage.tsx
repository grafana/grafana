import { Fragment } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { isTruthy } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AuthenticationTab } from './AuthenticationTab';
import { LoadError } from './LoadState';
import { OrganizationsTab } from './OrganizationsTab';
import { SessionsTab } from './SessionsTab';
import { UserDetails } from './UserDetails';
import { UserRoles } from './UserRoles';
import { UserTeams } from './UserTeams';
import { useUserOverview } from './hooks';

export default function UserOverviewPage() {
  const { id: uid = '', page = 'details' } = useParams();
  const baseUrl = `/admin/users/edit/${encodeURIComponent(uid)}`;
  const { user, profile, account, members } = useUserOverview(uid);
  const hasLdapSync =
    profile?.isExternal &&
    profile.isExternallySynced &&
    profile.authLabels?.includes('LDAP') &&
    featureEnabled('ldapsync') &&
    contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
  const tabs = [
    {
      id: 'details',
      label: t('admin.user-overview.details', 'User details'),
      render: () => <UserDetails uid={uid} />,
    },
    {
      id: 'teams',
      label: t('admin.user-overview.teams', 'Teams'),
      render: () => <UserTeams uid={uid} />,
    },
    {
      id: 'roles',
      label: t('admin.user-overview.roles', 'Roles'),
      render: () => <UserRoles uid={uid} />,
    },
    profile &&
      contextSrv.hasPermission(AccessControlAction.OrgsRead) && {
        id: 'organizations',
        label: t('admin.user-overview.organizations', 'Organizations'),
        render: () => <OrganizationsTab user={profile} />,
      },
    contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList) && {
      id: 'sessions',
      label: t('admin.user-overview.sessions', 'Sessions'),
      render: () => <SessionsTab uid={uid} />,
    },
    profile &&
      hasLdapSync && {
        id: 'authentication',
        label: t('admin.user-overview.authentication', 'Authentication'),
        render: () => <AuthenticationTab user={profile} />,
      },
  ].filter(isTruthy);
  const active = tabs.find(({ id }) => id === page) ?? tabs[0];
  const error = account.error || members.error;

  return (
    <Page
      navId="global-users"
      pageNav={{
        text: user?.login || t('admin.user-overview.title', 'User'),
        subTitle: user?.email,
        img: user?.avatarUrl,
        children: user
          ? tabs.map(({ id, label }) => ({
              text: label,
              url: id === 'details' ? baseUrl : `${baseUrl}/${id}`,
              active: id === active.id,
            }))
          : [],
      }}
    >
      <Page.Contents isLoading={!user && (account.isFetching || members.isFetching)}>
        {/* Keyed by user so that edits in progress do not carry over to another user. */}
        {user && <Fragment key={uid}>{active.render()}</Fragment>}
        {!user && Boolean(error) && <LoadError error={error} />}
        {!user && !error && (
          <Alert severity="warning" title={t('admin.user-overview.not-found', 'This information is not available')} />
        )}
      </Page.Contents>
    </Page>
  );
}
