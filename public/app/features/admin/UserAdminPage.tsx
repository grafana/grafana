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

  onUserUpdate = (user: UserDTO) => {
    console.log('update user', user);
  };

  onUserDelete = (userId: number) => {
    console.log('delete user', userId);
  };

  onUserDisable = (userId: number) => {
    console.log('disable user', userId);
  };

  onGrafanaAdminChange = (isGrafanaAdmin: boolean) => {
    console.log('onGrafanaAdminChange', isGrafanaAdmin);
  };

  onOrgRemove = (orgId: number) => {
    console.log('onOrgRemove', orgId);
  };

  onOrgRoleChange = (orgId: number, newRole: string) => {
    console.log('onOrgRoleChange', orgId, newRole);
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
    console.log('sync user', this.props.user.login);
  };

  render() {
    const { navModel, user, orgs, sessions, ldapSyncInfo } = this.props;
    const { isLoading } = this.state;
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
              />
              {isLDAPUser && config.buildInfo.isEnterprise && ldapSyncInfo && (
                <UserLdapSyncInfo ldapSyncInfo={ldapSyncInfo} onUserSync={this.onUserSync} />
              )}
              <UserPermissions isGrafanaAdmin={user.isGrafanaAdmin} onGrafanaAdminChange={this.onGrafanaAdminChange} />
            </>
          )}

          {orgs && <UserOrgs orgs={orgs} onOrgRemove={this.onOrgRemove} onOrgRoleChange={this.onOrgRoleChange} />}

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
});

const mapDispatchToProps = {
  loadUserProfile,
  loadUserOrgs,
  loadUserSessions,
  loadLdapSyncStatus,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(UserAdminPage));
