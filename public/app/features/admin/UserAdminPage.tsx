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
import {
  StoreState,
  UserDTO,
  UserOrg,
  UserSession,
  SyncInfo,
  UserAdminError,
  AccessControlAction,
  Dethunked,
} from 'app/types';
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
  user?: UserDTO;
  orgs: UserOrg[];
  sessions: UserSession[];
  ldapSyncInfo?: SyncInfo;
  isLoading: boolean;
  error?: UserAdminError;

  loadAdminUserPage: Dethunked<typeof loadAdminUserPage>;
  revokeSession: Dethunked<typeof revokeSession>;
  revokeAllSessions: Dethunked<typeof revokeAllSessions>;
  updateUser: Dethunked<typeof updateUser>;
  setUserPassword: Dethunked<typeof setUserPassword>;
  disableUser: Dethunked<typeof disableUser>;
  enableUser: Dethunked<typeof enableUser>;
  deleteUser: Dethunked<typeof deleteUser>;
  updateUserPermissions: Dethunked<typeof updateUserPermissions>;
  addOrgUser: Dethunked<typeof addOrgUser>;
  updateOrgUserRole: Dethunked<typeof updateOrgUserRole>;
  deleteOrgUser: Dethunked<typeof deleteOrgUser>;
  syncLdapUser: Dethunked<typeof syncLdapUser>;
}

export class UserAdminPage extends PureComponent<Props> {
  async componentDidMount() {
    const { match, loadAdminUserPage } = this.props;
    loadAdminUserPage(parseInt(match.params.id, 10));
  }

  onUserUpdate = (user: UserDTO) => {
    this.props.updateUser(user);
  };

  onPasswordChange = (password: string) => {
    const { user, setUserPassword } = this.props;
    user && setUserPassword(user.id, password);
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
    user && updateUserPermissions(user.id, isGrafanaAdmin);
  };

  onOrgRemove = (orgId: number) => {
    const { user, deleteOrgUser } = this.props;
    user && deleteOrgUser(user.id, orgId);
  };

  onOrgRoleChange = (orgId: number, newRole: string) => {
    const { user, updateOrgUserRole } = this.props;
    user && updateOrgUserRole(user.id, orgId, newRole);
  };

  onOrgAdd = (orgId: number, role: string) => {
    const { user, addOrgUser } = this.props;
    user && addOrgUser(user, orgId, role);
  };

  onSessionRevoke = (tokenId: number) => {
    const { user, revokeSession } = this.props;
    user && revokeSession(tokenId, user.id);
  };

  onAllSessionsRevoke = () => {
    const { user, revokeAllSessions } = this.props;
    user && revokeAllSessions(user.id);
  };

  onUserSync = () => {
    const { user, syncLdapUser } = this.props;
    user && syncLdapUser(user.id);
  };

  render() {
    const { navModel, user, orgs, sessions, ldapSyncInfo, isLoading } = this.props;
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
