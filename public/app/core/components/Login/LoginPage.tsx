import React, { FC } from 'react';
import config from 'app/core/config';
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from './ChangePassword';
import { CSSTransition } from 'react-transition-group';

const isOauthEnabled = () => Object.keys(config.oauth).length > 0;

export const LoginPage: FC = () => {
  return (
    <div className="login container">
      <div className="login-content">
        <div className="login-branding">
          <img className="logo-icon" src="public/img/grafana_icon.svg" alt="Grafana" />
          <div className="logo-wordmark" />
        </div>
        <LoginCtrl>
          {({ login, isLoggingIn, changePassword, toGrafana, isChangingPassword }) => (
            <div className="login-out-box">
              <div className={`login-inner-box ${isChangingPassword ? 'hidden' : ''}`} id="login-view">
                <LoginForm
                  displayLoginFields={!config.disableLoginForm}
                  displayForgotPassword={!(config.ldapEnabled || config.authProxyEnabled)}
                  onSubmit={login}
                  loginHint={config.loginHint}
                  passwordHint={config.passwordHint}
                  isLoggingIn={isLoggingIn}
                />

                {isOauthEnabled() ? (
                  <>
                    <div className="text-center login-divider">
                      <div>
                        <div className="login-divider-line" />
                      </div>
                      <div>
                        <span className="login-divider-text">{config.disableLoginForm ? null : <span>or</span>}</span>
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
              <CSSTransition appear={true} in={isChangingPassword} timeout={250} classNames="login-inner-box">
                <ChangePassword
                  onSubmit={changePassword}
                  onSkip={toGrafana}
                  focus={isChangingPassword}
                  className={isChangingPassword ? '' : 'hidden'}
                />
              </CSSTransition>
            </div>
          )}
        </LoginCtrl>

        <div className="clearfix" />
      </div>
    </div>
  );
};
