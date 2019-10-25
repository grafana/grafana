import React, { FC } from 'react';
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from './ChangePassword';
import { CSSTransition } from 'react-transition-group';

export const LoginPage: FC = () => {
  return (
    <div className="login container">
      <div className="login-content">
        <div className="login-branding">
          <img className="logo-icon" src="public/img/grafana_icon.svg" alt="Grafana" />
          <div className="logo-wordmark" />
        </div>
        <LoginCtrl>
          {({
            loginHint,
            passwordHint,
            isOauthEnabled,
            ldapEnabled,
            authProxyEnabled,
            disableLoginForm,
            disableUserSignUp,
            login,
            isLoggingIn,
            changePassword,
            skipPasswordChange,
            isChangingPassword,
          }) => (
            <div className="login-outer-box">
              <div className={`login-inner-box ${isChangingPassword ? 'hidden' : ''}`} id="login-view">
                {!disableLoginForm ? (
                  <LoginForm
                    displayForgotPassword={!(ldapEnabled || authProxyEnabled)}
                    onSubmit={login}
                    loginHint={loginHint}
                    passwordHint={passwordHint}
                    isLoggingIn={isLoggingIn}
                  />
                ) : null}

                <LoginServiceButtons />
                {!disableUserSignUp ? <UserSignup /> : null}
              </div>
              <CSSTransition
                appear={true}
                mountOnEnter={true}
                in={isChangingPassword}
                timeout={250}
                classNames="login-inner-box"
              >
                <ChangePassword onSubmit={changePassword} onSkip={skipPasswordChange} focus={isChangingPassword} />
              </CSSTransition>
            </div>
          )}
        </LoginCtrl>

        <div className="clearfix" />
      </div>
    </div>
  );
};
