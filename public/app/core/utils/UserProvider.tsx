import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { User, Team } from 'app/types';

export interface UserAPI {
  changePassword: (changePassword: ChangePasswordFields) => void;
  updateUserProfile: (profile: ProfileUpdateFields) => void;
  loadUser: () => void;
  loadTeams: () => void;
}

interface LoadingStates {
  changePassword: boolean;
  loadUser: boolean;
  loadTeams: boolean;
  updateUserProfile: boolean;
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
  children: (api: UserAPI, states: LoadingStates, teams: Team[], user?: User) => JSX.Element;
}

export interface State {
  user?: User;
  teams: Team[];
  loadingStates: LoadingStates;
}

export class UserProvider extends PureComponent<Props, State> {
  state: State = {
    teams: [] as Team[],
    loadingStates: {
      changePassword: false,
      loadUser: true,
      loadTeams: false,
      updateUserProfile: false,
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
    const { loadingStates, teams, user } = this.state;

    const api = {
      changePassword: this.changePassword,
      loadUser: this.loadUser,
      loadTeams: this.loadTeams,
      updateUserProfile: this.updateUserProfile,
    };

    return <>{children(api, loadingStates, teams, user)}</>;
  }
}

export default UserProvider;
