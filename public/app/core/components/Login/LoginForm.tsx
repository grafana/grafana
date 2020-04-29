import React, { ChangeEvent, PureComponent, SyntheticEvent, FC, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import { FormModel } from './LoginCtrl';
import { Button, Form, Input, Field } from '@grafana/ui';
import { css } from 'emotion';

interface Props {
  displayForgotPassword: boolean;
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

const forgottenPasswordStyles = css`
  display: block;
  margin-top: 20px;
  text-align: center;
`;

const wrapperStyles = css`
  width: 100%;
  padding-bottom: 15px;
`;

export const LoginForm: FC<Props> = ({ displayForgotPassword, onSubmit, isLoggingIn, passwordHint, loginHint }) => {
  const [hasBeenTouched, setHasBeenTouched] = useState(false);
  return (
    <div className={wrapperStyles}>
      <Form onSubmit={onSubmit} validateOn="onChange">
        {({ register, errors }) => (
          <>
            <Field label="Email or username" invalid={!!errors.user} error={errors.user?.message}>
              <Input
                onChange={() => setHasBeenTouched(true)}
                autoFocus
                name="user"
                ref={register({ required: 'Email or username is required' })}
                placeholder={loginHint}
                aria-label={selectors.pages.Login.username}
              />
            </Field>
            <Field label="Password" invalid={!!errors.password} error={errors.password?.message}>
              <Input
                onChange={() => setHasBeenTouched(true)}
                name="password"
                type="password"
                placeholder={passwordHint}
                ref={register({ required: 'Password is requireed' })}
                aria-label={selectors.pages.Login.password}
              />
            </Field>
            <Button
              className={css`
                justify-content: center;
                width: 100%;
              `}
              disabled={!hasBeenTouched || !!(errors.password || errors.user) || isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Log in'}
            </Button>
            {displayForgotPassword && (
              <a className={forgottenPasswordStyles} href="user/password/send-reset-email">
                Forgot your password?
              </a>
            )}
          </>
        )}
      </Form>
    </div>
  );
};
export class OldLoginForm extends PureComponent<Props, State> {
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

  // render() {
  //   return (
  //     <form name="loginForm" className="login-form-group gf-form-group">
  //       <div className="login-form">
  //         <input
  //           ref={input => {
  //             this.userInput = input;
  //           }}
  //           type="text"
  //           name="user"
  //           className="gf-form-input login-form-input"
  //           required
  //           placeholder={this.props.loginHint}
  //           aria-label={selectors.pages.Login.username}
  //           onChange={this.onChangeUsername}
  //         />
  //       </div>
  //       <div className="login-form">
  //         <input
  //           type="password"
  //           name="password"
  //           className="gf-form-input login-form-input"
  //           required
  //           ng-model="formModel.password"
  //           id="inputPassword"
  //           placeholder={this.props.passwordHint}
  //           aria-label={selectors.pages.Login.password}
  //           onChange={this.onChangePassword}
  //         />
  //       </div>
  //       <div className="login-button-group">
  //         {!this.props.isLoggingIn ? (
  //           <Button
  //             size="lg"
  //             variant="primary"
  //             type="submit"
  //             aria-label={selectors.pages.Login.submit}
  //             onClick={this.onSubmit}
  //             disabled={!this.state.valid}
  //           >
  //             Log in
  //           </Button>
  //         ) : (
  //           <button type="submit" disabled className="btn btn-large p-x-2 btn-inverse btn-loading">
  //             Logging In<span>.</span>
  //             <span>.</span>
  //             <span>.</span>
  //           </button>
  //         )}

  //         {this.props.displayForgotPassword ? (
  //           <div className="small login-button-forgot-password">
  //             <a href="user/password/send-reset-email">Forgot your password?</a>
  //           </div>
  //         ) : null}
  //       </div>
  //     </form>
  //   );
  // }
}
