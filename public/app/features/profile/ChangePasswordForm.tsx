import React, { PureComponent, MouseEvent } from 'react';
import config from 'app/core/config';
import { Button, LinkButton } from '@grafana/ui';
import { ChangePasswordFields } from 'app/core/utils/UserProvider';
import { PasswordInput } from 'app/core/components/PasswordInput/PasswordInput';

export interface Props {
  onChangePassword: (payload: ChangePasswordFields) => void;
}

export interface State {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}

export class ChangePasswordForm extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      oldPassword: '',
      newPassword: '',
      confirmNew: '',
    };
  }

  onOldPasswordChange(oldPassword: string) {
    this.setState({ oldPassword });
  }

  onNewPasswordChange(newPassword: string) {
    this.setState({ newPassword });
  }

  onConfirmPasswordChange(confirmNew: string) {
    this.setState({ confirmNew });
  }

  render() {
    const { oldPassword, newPassword, confirmNew } = this.state;
    const { onChangePassword } = this.props;
    const { ldapEnabled, authProxyEnabled } = config;

    if (ldapEnabled && authProxyEnabled) {
      return <p>You cannot change password when ldap or auth proxy authentication is enabled.</p>;
    } else {
      return (
        <form name="userForm" className="gf-form-group">
          <div className="gf-form max-width-30">
            <PasswordInput label="Old Password" onChange={this.onOldPasswordChange.bind(this)} value={oldPassword} />
          </div>
          <div className="gf-form max-width-30">
            <PasswordInput label="New Password" onChange={this.onNewPasswordChange.bind(this)} value={newPassword} />
          </div>
          <div className="gf-form max-width-30">
            <PasswordInput
              label="Confirm Password"
              onChange={this.onConfirmPasswordChange.bind(this)}
              value={confirmNew}
            />
          </div>
          <div className="gf-form-button-row">
            <Button
              variant="primary"
              onClick={(event: MouseEvent<HTMLInputElement>) => {
                event.preventDefault();
                onChangePassword({ oldPassword, newPassword, confirmNew });
              }}
            >
              Change Password
            </Button>
            <LinkButton variant="transparent" href={`${config.appSubUrl}/profile`}>
              Cancel
            </LinkButton>
          </div>
        </form>
      );
    }
  }
}

export default ChangePasswordForm;
