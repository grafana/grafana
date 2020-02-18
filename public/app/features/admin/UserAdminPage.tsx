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
import { GrafanaRoute } from '../../core/navigation/types';

interface Props extends GrafanaRoute<{ userId: string }> {
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
    const {
      match: { params },
      loadAdminUserPage,
    } = this.props;
    loadAdminUserPage(parseInt(params.userId, 10));
  }

  onUserUpdate = (user: UserDTO) => {
    this.props.updateUser(user);
  };

  onPasswordChange = (password: string) => {
    const {
      match: { params },
      setUserPassword,
    } = this.props;
    setUserPassword(parseInt(params.userId, 10), password);
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
    const {
      match: { params },
      updateUserPermissions,
    } = this.props;
    updateUserPermissions(parseInt(params.userId, 10), isGrafanaAdmin);
  };

  onOrgRemove = (orgId: number) => {
    const {
      match: { params },
      deleteOrgUser,
    } = this.props;
    deleteOrgUser(parseInt(params.userId, 10), orgId);
  };

  onOrgRoleChange = (orgId: number, newRole: string) => {
    const {
      match: { params },
      updateOrgUserRole,
    } = this.props;
    updateOrgUserRole(parseInt(params.userId, 10), orgId, newRole);
  };

  onOrgAdd = (orgId: number, role: string) => {
    const { user, addOrgUser } = this.props;
    addOrgUser(user, orgId, role);
  };

  onSessionRevoke = (tokenId: number) => {
    const {
      match: { params },
      revokeSession,
    } = this.props;
    revokeSession(tokenId, parseInt(params.userId, 10));
  };

  onAllSessionsRevoke = () => {
    const {
      match: { params },
      revokeAllSessions,
    } = this.props;
    revokeAllSessions(parseInt(params.userId, 10));
  };

  onUserSync = () => {
    const {
      match: { params },
      syncLdapUser,
    } = this.props;
    syncLdapUser(parseInt(params.userId, 10));
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
