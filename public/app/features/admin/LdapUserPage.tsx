import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import Page from '../../core/components/Page/Page';
import { AlertBox } from '../../core/components/AlertBox/AlertBox';
import { getNavModel } from '../../core/selectors/navModel';
import { AppNotificationSeverity, LdapError, LdapUser, StoreState, User, UserSession } from 'app/types';
import {
  loadUserMapping,
  clearUserError,
  loadUser,
  loadUserSessions,
  revokeSession,
  revokeAllSessions,
} from './state/actions';
import { LdapUserInfo } from './LdapUserInfo';
import { getRouteParamsId } from 'app/core/selectors/location';
import { UserSessions } from './UserSessions';
import { UserInfo } from './UserInfo';

interface Props {
  navModel: NavModel;
  userId: number;
  user: User;
  sessions: UserSession[];
  ldapUser: LdapUser;
  userError?: LdapError;

  loadUser: typeof loadUser;
  loadUserMapping: typeof loadUserMapping;
  clearUserError: typeof clearUserError;
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
    const { userId, loadUser, loadUserMapping, loadUserSessions } = this.props;
    try {
      await loadUser(userId);
      await loadUserSessions(userId);
      const { user } = this.props;
      await loadUserMapping(user.login);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  onClearUserError = () => {
    this.props.clearUserError();
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
    const { user, ldapUser, userError, navModel, sessions } = this.props;
    const { isLoading } = this.state;

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
  sessions: state.ldapUser.sessions,
});

const mapDispatchToProps = {
  loadUserMapping,
  clearUserError,
  loadUser,
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
