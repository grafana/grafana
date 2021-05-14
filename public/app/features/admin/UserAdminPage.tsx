import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import { UserProfile } from './UserProfile';
import { UserPermissions } from './UserPermissions';
import { UserSessions } from './UserSessions';
import { UserLdapSyncInfo } from './UserLdapSyncInfo';
import { StoreState, UserDTO, UserOrg, UserSession, SyncInfo, UserAdminError, AccessControlAction } from 'app/types';
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
import { UserOrgs } from './UserOrgs';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { contextSrv } from 'app/core/core';

interface Props extends GrafanaRouteComponentProps<{ id: string }> {
  navModel: NavModel;
  user: UserDTO;
  orgs: UserOrg[];
  sessions: UserSession[];
  ldapSyncInfo: SyncInfo;
  isLoading: boolean;
  error: UserAdminError;

  loadAdminUserPage: typeof loadAdminUserPage;
  revokeSession: typeof revokeSession;
  revokeAllSessions: typeof revokeAllSessions;
  updateUser: typeof updateUser;
  setUserPassword: typeof setUserPassword;
  disableUser: typeof disableUser;
  enableUser: typeof enableUser;
  deleteUser: typeof deleteUser;
  updateUserPermissions: typeof updateUserPermissions;
  addOrgUser: typeof addOrgUser;
  updateOrgUserRole: typeof updateOrgUserRole;
  deleteOrgUser: typeof deleteOrgUser;
  syncLdapUser: typeof syncLdapUser;
}

interface State {
  // isLoading: boolean;
}

export class UserAdminPage extends PureComponent<Props, State> {
  state = {
    // isLoading: true,
  };

  async componentDidMount() {
    const { match, loadAdminUserPage } = this.props;
    loadAdminUserPage(parseInt(match.params.id, 10));
  }

  onUserUpdate = (user: UserDTO) => {
    this.props.updateUser(user);
  };

  onPasswordChange = (password: string) => {
    const { user, setUserPassword } = this.props;
    setUserPassword(user.id, password);
  };

  onUserDelete = (userId: number) => {
    this.props.deleteUser(userId);
  };

  onUserDisable = (userId: number) => {
    this.props.disableUser(userId);
  };

  onUserEnable = (userId: number) => {
    this.props.enableUser(userId);
  };

  onGrafanaAdminChange = (isGrafanaAdmin: boolean) => {
    const { user, updateUserPermissions } = this.props;
    updateUserPermissions(user.id, isGrafanaAdmin);
  };

  onOrgRemove = (orgId: number) => {
    const { user, deleteOrgUser } = this.props;
    deleteOrgUser(user.id, orgId);
  };

  onOrgRoleChange = (orgId: number, newRole: string) => {
    const { user, updateOrgUserRole } = this.props;
    updateOrgUserRole(user.id, orgId, newRole);
  };

  onOrgAdd = (orgId: number, role: string) => {
    const { user, addOrgUser } = this.props;
    addOrgUser(user, orgId, role);
  };

  onSessionRevoke = (tokenId: number) => {
    const { user, revokeSession } = this.props;
    revokeSession(tokenId, user.id);
  };

  onAllSessionsRevoke = () => {
    const { user, revokeAllSessions } = this.props;
    revokeAllSessions(user.id);
  };

  onUserSync = () => {
    const { user, syncLdapUser } = this.props;
    syncLdapUser(user.id);
  };

  render() {
    const { navModel, user, orgs, sessions, ldapSyncInfo, isLoading } = this.props;
    // const { isLoading } = this.state;
    const isLDAPUser = user && user.isExternal && user.authLabels && user.authLabels.includes('LDAP');
    const canReadSessions = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList);
    const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          {user && (
            <>
              <UserProfile
                user={user}
                onUserUpdate={this.onUserUpdate}
                onUserDelete={this.onUserDelete}
                onUserDisable={this.onUserDisable}
                onUserEnable={this.onUserEnable}
                onPasswordChange={this.onPasswordChange}
              />
              {isLDAPUser && config.licenseInfo.hasLicense && ldapSyncInfo && canReadLDAPStatus && (
                <UserLdapSyncInfo ldapSyncInfo={ldapSyncInfo} user={user} onUserSync={this.onUserSync} />
              )}
              <UserPermissions isGrafanaAdmin={user.isGrafanaAdmin} onGrafanaAdminChange={this.onGrafanaAdminChange} />
            </>
          )}

          {orgs && (
            <UserOrgs
              orgs={orgs}
              onOrgRemove={this.onOrgRemove}
              onOrgRoleChange={this.onOrgRoleChange}
              onOrgAdd={this.onOrgAdd}
            />
          )}

          {sessions && canReadSessions && (
            <UserSessions
              sessions={sessions}
              onSessionRevoke={this.onSessionRevoke}
              onAllSessionsRevoke={this.onAllSessionsRevoke}
            />
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'global-users'),
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

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UserAdminPage));
