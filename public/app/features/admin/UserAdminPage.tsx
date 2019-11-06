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
import { StoreState, UserDTO, UserOrg, UserSession, SyncInfo } from 'app/types';
import {
  loadUserProfile,
  loadUserOrgs,
  loadUserSessions,
  revokeSession,
  revokeAllSessions,
  loadLdapSyncStatus,
} from './state/actions';
import { UserOrgs } from './UserOrgs';

interface Props {
  navModel: NavModel;
  userId: number;
  user: UserDTO;
  orgs: UserOrg[];
  sessions: UserSession[];
  ldapSyncInfo: SyncInfo;

  loadUserProfile: typeof loadUserProfile;
  loadUserOrgs: typeof loadUserOrgs;
  loadUserSessions: typeof loadUserSessions;
  loadLdapSyncStatus: typeof loadLdapSyncStatus;
  revokeSession: typeof revokeSession;
  revokeAllSessions: typeof revokeAllSessions;
}

interface State {
  isLoading: boolean;
}

export class UserAdminPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    const { userId, loadUserProfile, loadUserOrgs, loadUserSessions, loadLdapSyncStatus } = this.props;
    try {
      await loadUserProfile(userId);
      await loadUserOrgs(userId);
      await loadUserSessions(userId);
      await loadLdapSyncStatus();
    } finally {
      this.setState({ isLoading: false });
    }
  }

  handleUserDelete = (userId: number) => {
    console.log('delete user', userId);
  };

  handleUserDisable = (userId: number) => {
    console.log('disable user', userId);
  };

  handleGrafanaAdminChange = (isGrafanaAdmin: boolean) => {
    console.log('handleGrafanaAdminChange', isGrafanaAdmin);
  };

  handleOrgRemove = (orgId: number) => {
    console.log('handleOrgRemove', orgId);
  };

  handleOrgRoleChange = (orgId: number, newRole: string) => {
    console.log('handleOrgRoleChange', orgId, newRole);
  };

  handleSessionRevoke = (tokenId: number) => {
    const { userId, revokeSession } = this.props;
    revokeSession(tokenId, userId);
  };

  handleAllSessionsRevoke = () => {
    const { userId, revokeAllSessions } = this.props;
    revokeAllSessions(userId);
  };

  handleUserSync = () => {
    console.log('sync user', this.props.user.login);
  };

  render() {
    const { navModel, user, orgs, sessions, ldapSyncInfo } = this.props;
    const { isLoading } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          {user && (
            <>
              <UserProfile user={user} onUserDelete={this.handleUserDelete} onUserDisable={this.handleUserDisable} />
              {config.buildInfo.isEnterprise && ldapSyncInfo && (
                <UserLdapSyncInfo ldapSyncInfo={ldapSyncInfo} onUserSync={this.handleUserSync} />
              )}
              <UserPermissions
                isGrafanaAdmin={user.isGrafanaAdmin}
                onGrafanaAdminChange={this.handleGrafanaAdminChange}
              />
            </>
          )}

          {orgs && (
            <UserOrgs orgs={orgs} onOrgRemove={this.handleOrgRemove} onOrgRoleChange={this.handleOrgRoleChange} />
          )}

          {sessions && (
            <UserSessions
              sessions={sessions}
              onSessionRevoke={this.handleSessionRevoke}
              onAllSessionsRevoke={this.handleAllSessionsRevoke}
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
});

const mapDispatchToProps = {
  loadUserProfile,
  loadUserOrgs,
  loadUserSessions,
  loadLdapSyncStatus,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAdminPage)
);
