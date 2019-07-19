import React, { PureComponent } from 'react';
import config from 'app/core/config';
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from './ChangePassword';

const oauthEnabled = () => Object.keys(config.oauth).length > 0;
export interface Props {
  disabledLoginForm: boolean;
  passwordHint: string;
  loginHint: string;
  disableUserSignup: boolean;
  oauthEnabled: boolean;
  ldapEnabled: boolean;
  authProxyEnabled: boolean;
  onSubmit: Function;
}

export interface State {
  loggingIn: boolean;
  user: string;
  password: string;
  email: string;
  valid: boolean;
}

export class LoginPage extends PureComponent<Props, State> {
  submit: Function;
  constructor(props: Props) {
    super(props);
    this.state = {
      user: '',
      password: '',
      email: '',
      loggingIn: false,
      valid: false,
    };
  }

  render() {
    return (
      <div className="login container">
        <div className="login-content">
          <div className="login-branding">
            <img className="logo-icon" src="public/img/grafana_icon.svg" alt="Grafana" />
            <div className="logo-wordmark" />
          </div>
          <LoginCtrl>
            {({ login, loggingIn, changePassword, toGrafana }) =>
              changePassword ? (
                <ChangePassword onSubmit={() => {}} onSkip={toGrafana} />
              ) : (
                <div className="login-out-box">
                  <div className="login-inner-box" id="login-view">
                    <LoginForm
                      displayLoginFields={!config.disableLoginForm}
                      displayForgotPassword={!(config.ldapEnabled || config.authProxyEnabled)}
                      onSubmit={login}
                      loginHint={config.loginHint}
                      passwordHint={config.passwordHint}
                      loggingIn={loggingIn}
                    />

                    {oauthEnabled() ? (
                      <>
                        <div className="text-center login-divider">
                          <div>
                            <div className="login-divider-line" />
                          </div>
                          <div>
                            <span className="login-divider-text">
                              {config.disableLoginForm ? null : <span>or</span>}
                            </span>
                          </div>
                          <div>
                            <div className="login-divider-line" />
                          </div>
                        </div>
                        <div className="clearfix" />

                        <LoginServiceButtons />
                      </>
                    ) : null}

                    <UserSignup />
                  </div>
                </div>
              )
            }
          </LoginCtrl>

          <div className="clearfix" />
        </div>
      </div>
    );
  }
}
