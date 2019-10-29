import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { getRouteParamsId } from 'app/core/selectors/location';
import Page from 'app/core/components/Page/Page';
import { UserProfile } from './UserProfile';
import { UserSessions } from './UserSessions';
import { StoreState, UserDTO, UserOrg, UserSession } from 'app/types';
import { loadUserProfile, loadUserOrgs, loadUserSessions, revokeSession, revokeAllSessions } from './state/actions';

interface Props {
  navModel: NavModel;
  userId: number;
  user: UserDTO;
  orgs: UserOrg[];
  sessions: UserSession[];

  loadUserProfile: typeof loadUserProfile;
  loadUserOrgs: typeof loadUserOrgs;
  loadUserSessions: typeof loadUserSessions;
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
    const { userId, loadUserProfile, loadUserOrgs, loadUserSessions } = this.props;
    try {
      await loadUserProfile(userId);
      await loadUserOrgs(userId);
      await loadUserSessions(userId);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  handleUserDelete = (userId: number) => {
    console.log('delete user', userId);
  };

  handleSessionRevoke = (tokenId: number) => {
    const { userId, revokeSession } = this.props;
    revokeSession(tokenId, userId);
  };

  handleAllSessionsRevoke = () => {
    const { userId, revokeAllSessions } = this.props;
    revokeAllSessions(userId);
  };

  render() {
    const { navModel, user, orgs, sessions } = this.props;
    const { isLoading } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <UserProfile user={user} orgs={orgs} onUserDelete={this.handleUserDelete} />

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
});

const mapDispatchToProps = {
  loadUserProfile,
  loadUserOrgs,
  loadUserSessions,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(UserAdminPage)
);
