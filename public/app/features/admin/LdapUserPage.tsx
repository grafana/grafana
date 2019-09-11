import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import Page from '../../core/components/Page/Page';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
import { getNavModel } from '../../core/selectors/navModel';
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
  loadUserMapping,
  clearUserError,
  loadLdapUserInfo,
  loadUser,
  loadUserSessions,
  revokeSession,
  revokeAllSessions,
  loadLdapSyncStatus,
  syncUser,
} from './state/actions';
import { LdapUserInfo } from './LdapUserInfo';
import { getRouteParamsId } from 'app/core/selectors/location';
import { UserSessions } from './UserSessions';
import { UserInfo } from './UserInfo';
import { UserSyncInfo } from './UserSyncInfo';

interface Props {
  navModel: NavModel;
  userId: number;
  user: User;
  sessions: UserSession[];
  ldapUser: LdapUser;
  userError?: LdapError;
  ldapSyncInfo?: SyncInfo;

  loadLdapUserInfo: typeof loadLdapUserInfo;
  loadUser: typeof loadUser;
  loadUserMapping: typeof loadUserMapping;
  clearUserError: typeof clearUserError;
  loadLdapSyncStatus: typeof loadLdapSyncStatus;
  syncUser: typeof syncUser;
  loadUserSessions: typeof loadUserSessions;
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

    const tableStyle = css`
      margin-bottom: 48px;
    `;

    const headingStyle = css`
      margin-bottom: 24px;
    `;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="grafana-info-box">
            This user is synced via LDAP – all changes must be done in LDAP config file.
          </div>
          {userError && userError.title && (
            <AlertBox
              title={userError.title}
              severity={AppNotificationSeverity.Error}
              body={userError.body}
              onClose={this.onClearUserError}
            />
          )}
          {userSyncInfo && (
            <UserSyncInfo
              headingStyle={headingStyle}
              tableStyle={tableStyle}
              syncInfo={userSyncInfo}
              onSync={this.onSyncUser}
            />
          )}
          {ldapUser && <LdapUserInfo className={tableStyle} ldapUser={ldapUser} />}
          {!ldapUser && user && <UserInfo className={tableStyle} user={user} />}

          <h4 className={headingStyle}>Sessions</h4>
          {sessions && (
            <div className="gf-form-group">
              <div className="gf-form">
                <UserSessions sessions={sessions} onSessionRevoke={this.onSessionRevoke} />
              </div>
              <div className="gf-form-button-row">
                <button className="btn btn-danger" onClick={this.onAllSessionsRevoke}>
                  Logout user from all devices
                </button>
              </div>
            </div>
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
  loadUserMapping,
  clearUserError,
  loadUser,
  loadLdapSyncStatus,
  syncUser,
  loadUserSessions,
  revokeSession,
  revokeAllSessions,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(LdapUserPage)
);
