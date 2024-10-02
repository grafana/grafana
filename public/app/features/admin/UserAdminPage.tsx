import { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { StoreState, UserDTO, UserOrg, UserSession, SyncInfo, UserAdminError, AccessControlAction } from 'app/types';

import { UserLdapSyncInfo } from './UserLdapSyncInfo';
import { UserOrgs } from './UserOrgs';
import { UserPermissions } from './UserPermissions';
import { UserProfile } from './UserProfile';
import { UserSessions } from './UserSessions';
import {
  loadAdminUserPage,
  revokeSession,
  revokeAllSessions,
  updateUser,
  setUserPassword,
  disableUser,
  enableUser,
  deleteUser,
  updateUserPermissions,
  addOrgUser,
  updateOrgUserRole,
  deleteOrgUser,
  syncLdapUser,
} from './state/actions';

interface OwnProps {
  user?: UserDTO;
  orgs: UserOrg[];
  sessions: UserSession[];
  ldapSyncInfo?: SyncInfo;
  isLoading: boolean;
  error?: UserAdminError;
}

export const UserAdminPage = ({
  loadAdminUserPage,
  user,
  orgs,
  sessions,
  ldapSyncInfo,
  isLoading,
  updateUser,
  setUserPassword,
  deleteUser,
  disableUser,
  enableUser,
  updateUserPermissions,
  deleteOrgUser,
  updateOrgUserRole,
  addOrgUser,
  revokeSession,
  revokeAllSessions,
  syncLdapUser,
}: Props) => {
  const { id = '' } = useParams();
  useEffect(() => {
    const userId = parseInt(id, 10);
    loadAdminUserPage(userId);
  }, [id, loadAdminUserPage]);

  const onPasswordChange = (password: string) => {
    if (user) {
      setUserPassword(user.id, password);
    }
  };

  const onGrafanaAdminChange = (isGrafanaAdmin: boolean) => {
    if (user) {
      updateUserPermissions(user.id, isGrafanaAdmin);
    }
  };

  const onOrgRemove = (orgId: number) => {
    if (user) {
      deleteOrgUser(user.id, orgId);
    }
  };

  const onOrgRoleChange = (orgId: number, newRole: string) => {
    if (user) {
      updateOrgUserRole(user.id, orgId, newRole);
    }
  };

  const onOrgAdd = (orgId: number, role: string) => {
    if (user) {
      addOrgUser(user, orgId, role);
    }
  };

  const onSessionRevoke = (tokenId: number) => {
    if (user) {
      revokeSession(tokenId, user.id);
    }
  };

  const onAllSessionsRevoke = () => {
    if (user) {
      revokeAllSessions(user.id);
    }
  };

  const onUserSync = () => {
    if (user) {
      syncLdapUser(user.id);
    }
  };

  const isLDAPUser = user?.isExternal && user?.authLabels?.includes('LDAP');
  const canReadSessions = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList);
  const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
  const authSource = user?.authLabels?.[0];
  const lockMessage = authSource ? `Synced via ${authSource}` : '';
  const pageNav: NavModelItem = {
    text: user?.login ?? '',
    icon: 'shield',
    subTitle: 'Manage settings for an individual user.',
  };

  return (
    <Page navId="global-users" pageNav={pageNav}>
      <Page.Contents isLoading={isLoading}>
        <Stack gap={5} direction="column">
          {user && (
            <>
              <UserProfile
                user={user}
                onUserUpdate={updateUser}
                onUserDelete={deleteUser}
                onUserDisable={disableUser}
                onUserEnable={enableUser}
                onPasswordChange={onPasswordChange}
              />
              {isLDAPUser &&
                user?.isExternallySynced &&
                featureEnabled('ldapsync') &&
                ldapSyncInfo &&
                canReadLDAPStatus && (
                  <UserLdapSyncInfo ldapSyncInfo={ldapSyncInfo} user={user} onUserSync={onUserSync} />
                )}
              <UserPermissions
                isGrafanaAdmin={user.isGrafanaAdmin}
                isExternalUser={user?.isGrafanaAdminExternallySynced}
                lockMessage={lockMessage}
                onGrafanaAdminChange={onGrafanaAdminChange}
              />
            </>
          )}
          {orgs && (
            <UserOrgs
              user={user}
              orgs={orgs}
              isExternalUser={user?.isExternallySynced}
              onOrgRemove={onOrgRemove}
              onOrgRoleChange={onOrgRoleChange}
              onOrgAdd={onOrgAdd}
            />
          )}
          {sessions && canReadSessions && (
            <UserSessions
              sessions={sessions}
              onSessionRevoke={onSessionRevoke}
              onAllSessionsRevoke={onAllSessionsRevoke}
            />
          )}
        </Stack>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  user: state.userAdmin.user,
  sessions: state.userAdmin.sessions,
  orgs: state.userAdmin.orgs,
  ldapSyncInfo: state.ldap.syncInfo,
  isLoading: state.userAdmin.isLoading,
  error: state.userAdmin.error,
});

const mapDispatchToProps = {
  loadAdminUserPage,
  updateUser,
  setUserPassword,
  disableUser,
  enableUser,
  deleteUser,
  updateUserPermissions,
  addOrgUser,
  updateOrgUserRole,
  deleteOrgUser,
  revokeSession,
  revokeAllSessions,
  syncLdapUser,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = OwnProps & ConnectedProps<typeof connector>;
export default connector(UserAdminPage);
