import React, { PureComponent, SyntheticEvent, ChangeEvent } from 'react';
import { Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';

interface Props {
  onSubmit: (pw: string) => void;
  onSkip: Function;
  focus?: boolean;
}

interface State {
  newPassword: string;
  confirmNew: string;
  valid: boolean;
}

export class ChangePassword extends PureComponent<Props, State> {
  private userInput: HTMLInputElement;
  constructor(props: Props) {
    super(props);
    this.state = {
      newPassword: '',
      confirmNew: '',
      valid: false,
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.focus && this.props.focus) {
      this.focus();
    }
  }

  focus() {
    this.userInput.focus();
  }

  onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();

    const { newPassword, valid } = this.state;
    if (valid) {
      this.props.onSubmit(newPassword);
    } else {
      appEvents.emit(AppEvents.alertWarning, ['New passwords do not match']);
    }
  };

  onNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      newPassword: e.target.value,
      valid: this.validate('newPassword', e.target.value),
    });
  };

  onConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      confirmNew: e.target.value,
      valid: this.validate('confirmNew', e.target.value),
    });
  };

  onSkip = (e: SyntheticEvent) => {
    this.props.onSkip();
  };

  validate(changed: string, pw: string) {
    if (changed === 'newPassword') {
      return this.state.confirmNew === pw;
    } else if (changed === 'confirmNew') {
      return this.state.newPassword === pw;
    }
    return false;
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
              onChange={this.onNewPasswordChange}
              ref={input => {
                this.userInput = input;
              }}
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
              onChange={this.onConfirmPasswordChange}
            />
          </div>
          <div className="login-button-group login-button-group--right text-right">
            <Tooltip
              placement="bottom"
              content="If you skip you will be prompted to change password next time you login."
            >
              <a className="btn btn-link" onClick={this.onSkip}>
                Skip
              </a>
            </Tooltip>

            <button
              type="submit"
              className={`btn btn-large p-x-2 ${this.state.valid ? 'btn-primary' : 'btn-inverse'}`}
              onClick={this.onSubmit}
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
