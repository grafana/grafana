// Libraries
import React, { FC } from 'react';
import { cx } from 'emotion';

// Components
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from './ChangePassword';
import { Branding } from 'app/core/components/Branding/Branding';
import { useTheme } from '@grafana/ui';
import { getStyles } from './loginStyles';

export const LoginPage: FC = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Branding.LoginBackground className="login container">
      <div className={styles.loginContent}>
        <div className={styles.loginLogoWrapper}>
          <Branding.LoginLogo className={styles.loginLogo} />
          <div className={styles.titleWrapper}>
            <h1 className={styles.mainTitle}>{Branding.LoginMainTitle}</h1>
            <h3 className={styles.subTitle}>{Branding.LoginSubTitle}</h3>
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
            <div className={styles.loginOuterBox}>
              {!isChangingPassword && (
                <div className={`${styles.loginInnerBox} ${isChangingPassword ? 'hidden' : ''}`} id="login-view">
                  {!disableLoginForm && (
                    <LoginForm
                      displayForgotPassword={!(ldapEnabled || authProxyEnabled)}
                      onSubmit={login}
                      loginHint={loginHint}
                      passwordHint={passwordHint}
                      isLoggingIn={isLoggingIn}
                    />
                  )}

                  <LoginServiceButtons />
                  {!disableUserSignUp && <UserSignup />}
                </div>
              )}

              {isChangingPassword && (
                <div className={cx(styles.loginInnerBox, styles.enterAnimation)}>
                  <ChangePassword onSubmit={changePassword} onSkip={skipPasswordChange as any} />
                </div>
              )}
            </div>
          )}
        </LoginCtrl>

        <div className="clearfix" />
      </div>
    </Branding.LoginBackground>
  );
};
