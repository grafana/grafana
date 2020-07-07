import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import { UserProfile } from './UserProfile';
import { UserPermissions } from './UserPermissions';
import { UserSessions } from './UserSessions';
import { UserLdapSyncInfo } from './UserLdapSyncInfo';
import { StoreState, UserDTO, UserOrg, UserSession, SyncInfo, UserAdminError } from 'app/types';
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

interface Props {
  navModel: NavModel;
  userId: number;
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
    const { userId, loadAdminUserPage } = this.props;
    loadAdminUserPage(userId);
  }

  onUserUpdate = (user: UserDTO) => {
    this.props.updateUser(user);
  };

  onPasswordChange = (password: string) => {
    const { userId, setUserPassword } = this.props;
    setUserPassword(userId, password);
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
    const { userId, updateUserPermissions } = this.props;
    updateUserPermissions(userId, isGrafanaAdmin);
  };

  onOrgRemove = (orgId: number) => {
    const { userId, deleteOrgUser } = this.props;
    deleteOrgUser(userId, orgId);
  };

  onOrgRoleChange = (orgId: number, newRole: string) => {
    const { userId, updateOrgUserRole } = this.props;
    updateOrgUserRole(userId, orgId, newRole);
  };

  onOrgAdd = (orgId: number, role: string) => {
    const { user, addOrgUser } = this.props;
    addOrgUser(user, orgId, role);
  };

  onSessionRevoke = (tokenId: number) => {
    const { userId, revokeSession } = this.props;
    revokeSession(tokenId, userId);
  };

  onAllSessionsRevoke = () => {
    const { userId, revokeAllSessions } = this.props;
    revokeAllSessions(userId);
  };

  onUserSync = () => {
    const { userId, syncLdapUser } = this.props;
    syncLdapUser(userId);
  };

  render() {
    const { navModel, user, orgs, sessions, ldapSyncInfo, isLoading } = this.props;
    // const { isLoading } = this.state;
    const isLDAPUser = user && user.isExternal && user.authLabels && user.authLabels.includes('LDAP');

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
              {isLDAPUser && config.licenseInfo.hasLicense && ldapSyncInfo && (
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

          {sessions && (
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
  userId: getRouteParamsId(state.location),
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
