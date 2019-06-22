import React, { ChangeEvent, PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Input, Button, FormLabel } from '@grafana/ui';

export interface Props {
  userId: number;
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

  onPasswordChange = (password: string) => {
    this.setState({ password });
  };

  async updateUserPassword() {
    const { userId } = this.props;
    const payload = { password: this.state.password };

    await getBackendSrv().put('/api/admin/users/' + userId + '/password', payload);

    this.setState({ password: '' });
  }

  render() {
    const { password } = this.state;
    return (
      <>
        <h3 className="page-sub-heading">Change Password</h3>
        <form name="profileForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <FormLabel className="width-8">New Password</FormLabel>
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
