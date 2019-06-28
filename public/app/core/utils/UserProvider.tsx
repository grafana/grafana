import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';

export interface UserAPI {
  changePassword: (ChangePassword: ChangePassword) => void;
}
export interface ChangePassword {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}
export interface Props {
  children: (api: UserAPI) => JSX.Element;
}

export interface State {}

export class UserProvider extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  changePassword = async (payload: ChangePassword) => {
    await getBackendSrv().put('/api/user/password', payload);
  };

  render() {
    const { children } = this.props;

    const api = {
      changePassword: this.changePassword,
    };

    return <>{children(api)}</>;
  }
}

export default UserProvider;
