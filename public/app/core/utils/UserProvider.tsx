import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { User } from 'app/types';

export interface UserAPI {
  changePassword: (changePassword: ChangePasswordFields) => void;
  updateUserProfile: (profile: ProfileUpdateFields) => void;
  loadUser: () => void;
}

interface LoadingStates {
  changePassword: boolean;
  loadUser: boolean;
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
  children: (api: UserAPI, states: LoadingStates, user?: User) => JSX.Element;
}

export interface State {
  user?: User;
  loadingStates: LoadingStates;
}

export class UserProvider extends PureComponent<Props, State> {
  state: State = {
    loadingStates: {
      changePassword: false,
      loadUser: true,
      updateUserProfile: false,
    },
  };

  componentDidMount() {
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
    const { loadingStates, user } = this.state;

    const api = {
      changePassword: this.changePassword,
      loadUser: this.loadUser,
      updateUserProfile: this.updateUserProfile,
    };

    return <>{children(api, loadingStates, user)}</>;
  }
}

export default UserProvider;
