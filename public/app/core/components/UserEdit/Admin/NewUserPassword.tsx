import React, { ChangeEvent, PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Input, Button } from '@grafana/ui';

export interface Props {
  uid: number;
}

export interface State {
  password: string;
}

export class NewUserPassword extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      password: '',
    };
  }

  onPasswordChange = password => {
    this.setState({ password });
  };

  updateUserPassword = async () => {
    const { uid } = this.props;
    const payload = { password: this.state.password };

    await getBackendSrv().put('/api/admin/users/' + uid + '/password', payload);

    this.setState({ password: '' });
  };

  render() {
    const { password } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">Change Password</h3>
        <form name="profileForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <span className="gf-form-label width-8">New Password</span>
            <Input
              className="gf-form-input max-width-22"
              type="password"
              onChange={(event: ChangeEvent<HTMLInputElement>) => this.onPasswordChange(event.target.value)}
              value={password}
            />
          </div>
          <div className="gf-form-button-row">
            <Button
              onClick={event => {
                event.preventDefault();
                this.updateUserPassword();
              }}
            >
              Save
            </Button>
          </div>
        </form>
      </>
    );
  }
}

export default NewUserPassword;
