// Libraries
import React, { FC } from 'react';
import { css } from 'emotion';
import { CSSTransition } from 'react-transition-group';

// Components
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from './ChangePassword';
import { Branding } from 'app/core/components/Branding/Branding';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

export const LoginPage: FC = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Branding.LoginBackground className="login container">
      <div className={styles.loginContent}>
        <div className={styles.loginLogoWrapper}>
          <Branding.LoginLogo className="login-logo" />
          <div className={styles.titleWrapper}>
            <h1 className={styles.mainTitle}>{Branding.LoginMainTitle}</h1>
            <h3 className={styles.subTitle}>{Branding.LoginSubTtitle}</h3>
          </div>
        </div>
        <LoginCtrl>
          {({
            loginHint,
            passwordHint,
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
    </Branding.LoginBackground>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  let boxBackground = theme.isLight ? 'rgba(6, 42, 88, 0.65)' : 'rgba(18, 28, 41, 0.65)';

  return {
    loginLogoWrapper: css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: ${theme.spacing.lg};
    `,
    titleWrapper: css`
      text-align: center;
    `,
    mainTitle: css`
      font-size: '32px';
    `,
    subTitle: css`
      font-size: ${theme.typography.size.md};
    `,
    loginContent: css`
      max-width: 550px;
      width: 100%;
      display: flex;
      align-items: stretch;
      flex-direction: column;
      position: relative;
      justify-content: center;
      z-index: 1;
      min-height: 320px;
      border-radius: 3px;
      background: ${boxBackground};
    `,
  };
});
