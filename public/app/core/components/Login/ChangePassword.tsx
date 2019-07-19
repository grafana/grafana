import React, { PureComponent, SyntheticEvent } from 'react';
import { Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';

interface Props {
  onSubmit: (pw: { newPassword: string; confirmNew: string }, valid: boolean) => void;
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

  handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();

    const { newPassword, confirmNew } = this.state;
    if (this.state.valid) {
      this.props.onSubmit({ newPassword, confirmNew }, true);
    } else {
      appEvents.on('alert-warning', ['New passwords do not match', '']);
    }
  };

  handleChange = (e: SyntheticEvent) => {
    // @ts-ignore
    this.setState({ [e.target.name]: e.target.value }, () => {
      this.setState({
        valid: this.validate(),
      });
    });
  };

  validate() {
    return this.state.newPassword === this.state.confirmNew;
  }

  render() {
    return (
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
              onChange={this.handleChange}
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
              onChange={this.handleChange}
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
              onClick={this.handleSubmit}
              disabled={!this.state.valid}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    );
  }
}
