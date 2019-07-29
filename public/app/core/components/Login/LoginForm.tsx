import React, { PureComponent, SyntheticEvent } from 'react';
import { FormModel } from './LoginCtrl';

interface Props {
  displayForgotPassword: boolean;
  displayLoginFields: boolean;
  onChange?: (valid: boolean) => void;
  onSubmit: (data: FormModel, valid: boolean) => void;
  loggingIn: boolean;
  passwordHint: string;
  loginHint: string;
}

interface State {
  user: string;
  password: string;
  email: string;
  valid: boolean;
}

export class LoginForm extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      user: '',
      password: '',
      email: '',
      valid: false,
    };
  }

  onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();

    const { user, password, email } = this.state;
    if (this.state.valid) {
      this.props.onSubmit({ user, password, email }, this.state.valid);
    }
  };

  onChange = (e: SyntheticEvent) => {
    // @ts-ignore
    this.setState({ [e.target.name]: e.target.value }, () => {
      this.setState({ valid: this.validate() }, () => {
        if (this.props.onChange) {
          this.props.onChange(this.state.valid);
        }
      });
    });
  };

  validate() {
    if (this.state.user.length > 0 && this.state.password.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  render() {
    return this.props.displayLoginFields ? (
      <form name="loginForm" className="login-form-group gf-form-group">
        <div className="login-form">
          <input
            type="text"
            name="user"
            className="gf-form-input login-form-input"
            required
            // ng-model="formModel.user"
            placeholder={this.props.loginHint}
            aria-label="Username input field"
            onChange={this.onChange}
          />
        </div>
        <div className="login-form">
          <input
            type="password"
            name="password"
            className="gf-form-input login-form-input"
            required
            ng-model="formModel.password"
            id="inputPassword"
            placeholder={this.props.passwordHint}
            aria-label="Password input field"
            onChange={this.onChange}
          />
        </div>
        <div className="login-button-group">
          {!this.props.loggingIn ? (
            <button
              type="submit"
              aria-label="Login button"
              className={`btn btn-large p-x-2 ${this.state.valid ? 'btn-primary' : 'btn-inverse'}`}
              onClick={this.onSubmit}
              disabled={!this.state.valid}
            >
              Log In
            </button>
          ) : (
            <button type="submit" className="btn btn-large p-x-2 btn-inverse btn-loading">
              Logging In<span>.</span>
              <span>.</span>
              <span>.</span>
            </button>
          )}

          {this.props.displayForgotPassword ? (
            <div className="small login-button-forgot-password">
              <a href="user/password/send-reset-email">Forgot your password?</a>
            </div>
          ) : null}
        </div>
      </form>
    ) : null;
  }
}
