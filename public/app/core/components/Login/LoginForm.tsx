import React, { PureComponent, SyntheticEvent, ChangeEvent } from 'react';
import { FormModel } from './LoginCtrl';

interface Props {
  displayForgotPassword: boolean;
  onChange?: (valid: boolean) => void;
  onSubmit: (data: FormModel) => void;
  isLoggingIn: boolean;
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
  private userInput: HTMLInputElement;
  constructor(props: Props) {
    super(props);
    this.state = {
      user: '',
      password: '',
      email: '',
      valid: false,
    };
  }

  componentDidMount() {
    this.userInput.focus();
  }
  onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();

    const { user, password, email } = this.state;
    if (this.state.valid) {
      this.props.onSubmit({ user, password, email });
    }
  };

  onChangePassword = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      password: e.target.value,
      valid: this.validate(this.state.user, e.target.value),
    });
  };

  onChangeUsername = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      user: e.target.value,
      valid: this.validate(e.target.value, this.state.password),
    });
  };

  validate(user: string, password: string) {
    return user.length > 0 && password.length > 0;
  }

  render() {
    return (
      <form name="loginForm" className="login-form-group gf-form-group">
        <div className="login-form">
          <input
            ref={input => {
              this.userInput = input;
            }}
            type="text"
            name="user"
            className="gf-form-input login-form-input"
            required
            placeholder={this.props.loginHint}
            aria-label="Username input field"
            onChange={this.onChangeUsername}
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
            onChange={this.onChangePassword}
          />
        </div>
        <div className="login-button-group">
          {!this.props.isLoggingIn ? (
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
    );
  }
}
