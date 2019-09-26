import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { Alert } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import {
  AppNotificationSeverity,
  LdapError,
  LdapUser,
  StoreState,
  User,
  UserSession,
  SyncInfo,
  LdapUserSyncInfo,
} from 'app/types';
import {
  clearUserError,
  loadLdapUserInfo,
  revokeSession,
  revokeAllSessions,
  loadLdapSyncStatus,
  syncUser,
} from '../state/actions';
import { LdapUserInfo } from './LdapUserInfo';
import { getRouteParamsId } from 'app/core/selectors/location';
import { UserSessions } from '../UserSessions';
import { UserInfo } from '../UserInfo';
import { UserSyncInfo } from '../UserSyncInfo';

interface Props {
  navModel: NavModel;
  userId: number;
  user: User;
  sessions: UserSession[];
  ldapUser: LdapUser;
  userError?: LdapError;
  ldapSyncInfo?: SyncInfo;

  loadLdapUserInfo: typeof loadLdapUserInfo;
  clearUserError: typeof clearUserError;
  loadLdapSyncStatus: typeof loadLdapSyncStatus;
  syncUser: typeof syncUser;
  revokeSession: typeof revokeSession;
  revokeAllSessions: typeof revokeAllSessions;
}

interface State {
  isLoading: boolean;
}

export class LdapUserPage extends PureComponent<Props, State> {
  state = {
    isLoading: true,
  };

  async componentDidMount() {
    const { userId, loadLdapUserInfo, loadLdapSyncStatus } = this.props;
    try {
      await loadLdapUserInfo(userId);
      await loadLdapSyncStatus();
    } finally {
      this.setState({ isLoading: false });
    }
  }

  onClearUserError = () => {
    this.props.clearUserError();
  };

  onSyncUser = () => {
    const { syncUser, user } = this.props;
    if (syncUser && user) {
      syncUser(user.id);
    }
  };

  onSessionRevoke = (tokenId: number) => {
    const { userId, revokeSession } = this.props;
    revokeSession(tokenId, userId);
  };

  onAllSessionsRevoke = () => {
    const { userId, revokeAllSessions } = this.props;
    revokeAllSessions(userId);
  };

  isUserError = (): boolean => {
    return !!(this.props.userError && this.props.userError.title);
  };

  render() {
    const { user, ldapUser, userError, navModel, sessions, ldapSyncInfo } = this.props;
    const { isLoading } = this.state;

    const userSyncInfo: LdapUserSyncInfo = {};
    if (ldapSyncInfo) {
      userSyncInfo.nextSync = ldapSyncInfo.nextSync;
    }
    if (user) {
      userSyncInfo.prevSync = (user as any).updatedAt;
    }

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="grafana-info-box">
            This user is synced via LDAP – All changes must be done in LDAP or mappings.
          </div>
          {userError && userError.title && (
            <div className="gf-form-group">
              <Alert
                title={userError.title}
                severity={AppNotificationSeverity.Error}
                children={userError.body}
                onRemove={this.onClearUserError}
              />
            </div>
          )}

          {userSyncInfo && (
            <UserSyncInfo syncInfo={userSyncInfo} onSync={this.onSyncUser} disableSync={this.isUserError()} />
          )}

          {ldapUser && <LdapUserInfo ldapUser={ldapUser} />}
          {!ldapUser && user && <UserInfo user={user} />}

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
  user: state.ldapUser.user,
  ldapUser: state.ldapUser.ldapUser,
  userError: state.ldapUser.userError,
  ldapSyncInfo: state.ldapUser.ldapSyncInfo,
  sessions: state.ldapUser.sessions,
});

const mapDispatchToProps = {
  loadLdapUserInfo,
  loadLdapSyncStatus,
  syncUser,
  revokeSession,
  revokeAllSessions,
  clearUserError,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapUserPage)
);
