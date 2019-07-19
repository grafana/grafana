import React, { PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';

interface Props {
  display: boolean;
  onSubmit: Function;
  onSkip: Function;
}

interface State {
  newPassword: string;
  confirmNew: string;
  valid: boolean;
}

export class ChangePassword extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newPassword: '',
      confirmNew: '',
      valid: false,
    };
  }
  handleSubmit() {}

  validate() {}

  render() {
    return this.props.display ? (
      <div className="login-inner-box" id="change-password-view">
        <div className="text-left login-change-password-info">
          <h5>Change Password</h5>
          Before you can get started with awesome dashboards we need you to make your account more secure by changing
          your password.
          <br />
          You can change your password again later.
        </div>
        <form className="login-form-group gf-form-group">
          <div className="login-form">
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              className="gf-form-input login-form-input"
              required
              placeholder="New password"
            />
          </div>
          <div className="login-form">
            <input
              type="password"
              name="confirmNew"
              className="gf-form-input login-form-input"
              required
              ng-model="command.confirmNew"
              placeholder="Confirm new password"
            />
          </div>
          <div className="login-button-group login-button-group--right text-right">
            <Tooltip
              placement="bottom"
              content="If you skip you will be prompted to change password next time you login."
            >
              <a className="btn btn-link" onClick={() => this.props.onSkip()}>
                Skip
              </a>
            </Tooltip>

            <button
              type="submit"
              className={`btn btn-large p-x-2 ${this.state.valid ? 'btn-primary' : 'btn-inverse'}`}
              ng-click="changePassword();"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    ) : null;
  }
}
