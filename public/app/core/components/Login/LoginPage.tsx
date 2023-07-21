// Libraries
import { css } from '@emotion/css';
import React from 'react';

// Components
import { Alert, HorizontalGroup, LinkButton } from '@grafana/ui';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';

import { ChangePassword } from '../ForgottenPassword/ChangePassword';

import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { LoginLayout, InnerBox } from './LoginLayout';
import { LoginServiceButtons } from './LoginServiceButtons';
import { UserSignup } from './UserSignup';

const forgottenPasswordStyles = css`
  padding: 0;
  margin-top: 4px;
`;

const alertStyles = css({
  width: '100%',
});

export const LoginPage = () => {
  document.title = Branding.AppTitle;
  return (
    <LoginCtrl>
      {({
        loginHint,
        passwordHint,
        disableLoginForm,
        disableUserSignUp,
        login,
        isLoggingIn,
        changePassword,
        skipPasswordChange,
        isChangingPassword,
        showDefaultPasswordWarning,
        loginErrorMessage,
      }) => (
        <LoginLayout isChangingPassword={isChangingPassword}>
          {!isChangingPassword && (
            <InnerBox>
              {loginErrorMessage && <Alert className={alertStyles} severity="error" title={loginErrorMessage} />}

              {!disableLoginForm && (
                <LoginForm onSubmit={login} loginHint={loginHint} passwordHint={passwordHint} isLoggingIn={isLoggingIn}>
                  <HorizontalGroup justify="flex-end">
                    <LinkButton
                      className={forgottenPasswordStyles}
                      fill="text"
                      href={`${config.appSubUrl}/user/password/send-reset-email`}
                    >
                      Forgot your password?
                    </LinkButton>
                  </HorizontalGroup>
                </LoginForm>
              )}
              <LoginServiceButtons />
              {!disableUserSignUp && <UserSignup />}
            </InnerBox>
          )}

          {isChangingPassword && (
            <InnerBox>
              <ChangePassword
                showDefaultPasswordWarning={showDefaultPasswordWarning}
                onSubmit={changePassword}
                onSkip={() => skipPasswordChange()}
              />
            </InnerBox>
          )}
        </LoginLayout>
      )}
    </LoginCtrl>
  );
};
