import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { User, Team } from 'app/types';
import { config } from 'app/core/config';

export interface UserAPI {
  changePassword: (changePassword: ChangePasswordFields) => void;
  updateUserProfile: (profile: ProfileUpdateFields) => void;
  loadUser: () => void;
  loadTeams: () => void;
  loadOrgs: () => void;
  setUserOrg: (org: UserOrg) => void;
}

interface LoadingStates {
  changePassword: boolean;
  loadUser: boolean;
  loadTeams: boolean;
  loadOrgs: boolean;
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

export interface UserOrg {
  orgId: number;
  name: string;
  role: string;
}

export interface Props {
  userId?: number; // passed, will load user on mount
  children: (api: UserAPI, states: LoadingStates, teams: Team[], orgs: UserOrg[], user?: User) => JSX.Element;
}

export interface State {
  user?: User;
  teams: Team[];
  orgs: UserOrg[];
  loadingStates: LoadingStates;
}

export class UserProvider extends PureComponent<Props, State> {
  state: State = {
    teams: [] as Team[],
    orgs: [] as UserOrg[],
    loadingStates: {
      changePassword: false,
      loadUser: true,
      loadTeams: false,
      loadOrgs: false,
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
      .then(() => {
        this.loadUser();
      })
      .catch(e => console.log(e))
      .finally(() => {
        this.setState({ loadingStates: { ...this.state.loadingStates, updateUserProfile: false } });
      });
  };

  render() {
    const { children } = this.props;
    const { loadingStates, teams, orgs, user } = this.state;

    const api = {
      changePassword: this.changePassword,
      loadUser: this.loadUser,
      loadTeams: this.loadTeams,
      loadOrgs: this.loadOrgs,
      updateUserProfile: this.updateUserProfile,
      setUserOrg: this.setUserOrg,
    };

    return <>{children(api, loadingStates, teams, orgs, user)}</>;
  }
}

export default UserProvider;
