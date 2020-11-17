import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { User, Team, UserOrg, UserSession } from 'app/types';
import { config } from 'app/core/config';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';

export interface UserAPI {
  changePassword: (changePassword: ChangePasswordFields) => void;
  updateUserProfile: (profile: ProfileUpdateFields) => void;
  loadUser: () => void;
  loadTeams: () => void;
  loadOrgs: () => void;
  loadSessions: () => void;
  setUserOrg: (org: UserOrg) => void;
  revokeUserSession: (tokenId: number) => void;
}

export interface LoadingStates {
  changePassword: boolean;
  loadUser: boolean;
  loadTeams: boolean;
  loadOrgs: boolean;
  loadSessions: boolean;
  updateUserProfile: boolean;
  updateUserOrg: boolean;
}

export interface ChangePasswordFields {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}

export interface ProfileUpdateFields {
  name: string;
  email: string;
  login: string;
}

export interface Props {
  userId?: number; // passed, will load user on mount
  children: (
    api: UserAPI,
    states: LoadingStates,
    teams: Team[],
    orgs: UserOrg[],
    sessions: UserSession[],
    user?: User
  ) => JSX.Element;
}

export interface State {
  user?: User;
  teams: Team[];
  orgs: UserOrg[];
  sessions: UserSession[];
  loadingStates: LoadingStates;
}

export class UserProvider extends PureComponent<Props, State> {
  state: State = {
    teams: [] as Team[],
    orgs: [] as UserOrg[],
    sessions: [] as UserSession[],
    loadingStates: {
      changePassword: false,
      loadUser: true,
      loadTeams: false,
      loadOrgs: false,
      loadSessions: false,
      updateUserProfile: false,
      updateUserOrg: false,
    },
  };

  componentWillMount() {
    if (this.props.userId) {
      this.loadUser();
    }
  }

  changePassword = async (payload: ChangePasswordFields) => {
    this.setState({ loadingStates: { ...this.state.loadingStates, changePassword: true } });
    await getBackendSrv().put('/api/user/password', payload);
    this.setState({ loadingStates: { ...this.state.loadingStates, changePassword: false } });
  };

  loadUser = async () => {
    this.setState({
      loadingStates: { ...this.state.loadingStates, loadUser: true },
    });
    const user = await getBackendSrv().get('/api/user');
    this.setState({ user, loadingStates: { ...this.state.loadingStates, loadUser: Object.keys(user).length === 0 } });
  };

  loadTeams = async () => {
    this.setState({
      loadingStates: { ...this.state.loadingStates, loadTeams: true },
    });
    const teams = await getBackendSrv().get('/api/user/teams');
    this.setState({ teams, loadingStates: { ...this.state.loadingStates, loadTeams: false } });
  };

  loadOrgs = async () => {
    this.setState({
      loadingStates: { ...this.state.loadingStates, loadOrgs: true },
    });
    const orgs = await getBackendSrv().get('/api/user/orgs');
    this.setState({ orgs, loadingStates: { ...this.state.loadingStates, loadOrgs: false } });
  };

  loadSessions = async () => {
    this.setState({
      loadingStates: { ...this.state.loadingStates, loadSessions: true },
    });

    await getBackendSrv()
      .get('/api/user/auth-tokens')
      .then((sessions: UserSession[]) => {
        sessions = sessions
          // Show active sessions first
          .sort((a, b) => Number(b.isActive) - Number(a.isActive))
          .map((session: UserSession) => {
            return {
              id: session.id,
              isActive: session.isActive,
              seenAt: dateTimeFormatTimeAgo(session.seenAt),
              createdAt: dateTimeFormat(session.createdAt, { format: 'MMMM DD, YYYY' }),
              clientIp: session.clientIp,
              browser: session.browser,
              browserVersion: session.browserVersion,
              os: session.os,
              osVersion: session.osVersion,
              device: session.device,
            };
          });

        this.setState({ sessions, loadingStates: { ...this.state.loadingStates, loadSessions: false } });
      });
  };

  revokeUserSession = async (tokenId: number) => {
    await getBackendSrv()
      .post('/api/user/revoke-auth-token', {
        authTokenId: tokenId,
      })
      .then(() => {
        const sessions = this.state.sessions.filter((session: UserSession) => {
          return session.id !== tokenId;
        });

        this.setState({ sessions });
      });
  };

  setUserOrg = async (org: UserOrg) => {
    this.setState({
      loadingStates: { ...this.state.loadingStates, updateUserOrg: true },
    });
    await getBackendSrv()
      .post('/api/user/using/' + org.orgId, {})
      .then(() => {
        window.location.href = config.appSubUrl + '/profile';
      })
      .finally(() => {
        this.setState({ loadingStates: { ...this.state.loadingStates, updateUserOrg: false } });
      });
  };

  updateUserProfile = async (payload: ProfileUpdateFields) => {
    this.setState({ loadingStates: { ...this.state.loadingStates, updateUserProfile: true } });
    await getBackendSrv()
      .put('/api/user', payload)
      .then(this.loadUser)
      .catch(e => console.error(e))
      .finally(() => {
        this.setState({ loadingStates: { ...this.state.loadingStates, updateUserProfile: false } });
      });
  };

  render() {
    const { children } = this.props;
    const { loadingStates, teams, orgs, sessions, user } = this.state;

    const api: UserAPI = {
      changePassword: this.changePassword,
      loadUser: this.loadUser,
      loadTeams: this.loadTeams,
      loadOrgs: this.loadOrgs,
      loadSessions: this.loadSessions,
      revokeUserSession: this.revokeUserSession,
      updateUserProfile: this.updateUserProfile,
      setUserOrg: this.setUserOrg,
    };

    return <>{children(api, loadingStates, teams, orgs, sessions, user)}</>;
  }
}

export default UserProvider;
