import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';

export interface UserAPI {
  changePassword: (ChangePassword: ChangePasswordFields) => void;
}

interface LoadingStates {
  changePassword: boolean;
}

export interface ChangePasswordFields {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}

export interface Props {
  children: (api: UserAPI, states: LoadingStates) => JSX.Element;
}

export interface State {
  loadingStates: LoadingStates;
}

export class UserProvider extends PureComponent<Props, State> {
  state: State = {
    loadingStates: {
      changePassword: false,
    },
  };

  changePassword = async (payload: ChangePasswordFields) => {
    this.setState({ loadingStates: { ...this.state.loadingStates, changePassword: true } });
    await getBackendSrv().put('/api/user/password', payload);
    this.setState({ loadingStates: { ...this.state.loadingStates, changePassword: false } });
  };

  render() {
    const { children } = this.props;
    const { loadingStates } = this.state;

    const api = {
      changePassword: this.changePassword,
    };

    return <>{children(api, loadingStates)}</>;
  }
}

export default UserProvider;
