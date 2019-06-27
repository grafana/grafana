import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';

export interface Props {
  children: (props: any) => React.ReactNode;
}

export interface State {}

export class UserProvider extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  changePassword = async payload => {
    await getBackendSrv().put('/api/user/password', payload);
  };

  render() {
    const { children } = this.props;

    const props = {
      changePassword: this.changePassword.bind(this),
    };

    return <>{children(props)}</>;
  }
}

export default UserProvider;
