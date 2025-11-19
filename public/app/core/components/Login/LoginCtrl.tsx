import { memo, useState, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { FetchError, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import config from 'app/core/config';

import { LoginDTO, AuthNRedirectDTO } from './types';

const isOauthEnabled = () => {
  return !!config.oauth && Object.keys(config.oauth).length > 0;
};

const showPasswordlessConfirmation = () => {
  const queryValues = locationService.getSearch();
  return !!queryValues.get('code');
};

export interface FormModel {
  user: string;
  password: string;
  email: string;
}

export interface PasswordlessFormModel {
  email: string;
}

export interface PasswordlessConfirmationFormModel {
  code: string;
  confirmationCode: string;
  username?: string;
  name?: string;
}

interface Props {
  resetCode?: string;

  children: (props: {
    isLoggingIn: boolean;
    changePassword: (pw: string) => void;
    isChangingPassword: boolean;
    skipPasswordChange: Function;
    login: (data: FormModel) => void;
    passwordlessStart: (data: PasswordlessFormModel) => void;
    passwordlessConfirm: (data: PasswordlessConfirmationFormModel) => void;
    showPasswordlessConfirmation: boolean;
    disableLoginForm: boolean;
    disableUserSignUp: boolean;
    isOauthEnabled: boolean;
    loginHint: string;
    passwordHint: string;
    showDefaultPasswordWarning: boolean;
    loginErrorMessage: string | undefined;
  }) => JSX.Element;
}

export const LoginCtrl = memo(({ resetCode, children }: Props) => {
  const [result, setResult] = useState<LoginDTO | undefined>();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDefaultPasswordWarning, setShowDefaultPasswordWarning] = useState(false);
  // oAuth unauthorized sets the redirect error message in the bootdata, hence we need to check the key here
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | undefined>(
    getBootDataErrMessage(config.loginError)
  );

  const toGrafana = useCallback(() => {
    if (config.featureToggles.useSessionStorageForRedirection) {
      window.location.assign(config.appSubUrl + '/');
      return;
    }

    if (result?.redirectUrl) {
      if (config.appSubUrl !== '' && !result.redirectUrl.startsWith(config.appSubUrl)) {
        window.location.assign(config.appSubUrl + result.redirectUrl);
      } else {
        window.location.assign(result.redirectUrl);
      }
    } else {
      window.location.assign(config.appSubUrl + '/');
    }
  }, [result]);

  const changePassword = useCallback(
    (password: string) => {
      const pw = {
        newPassword: password,
        confirmNew: password,
        oldPassword: 'admin',
      };

      if (resetCode) {
        const resetModel = {
          code: resetCode,
          newPassword: password,
          confirmPassword: password,
        };

        getBackendSrv()
          .post('/api/user/password/reset', resetModel)
          .then(() => {
            toGrafana();
          });
      } else {
        getBackendSrv()
          .put('/api/user/password', pw)
          .then(() => {
            toGrafana();
          })
          .catch((err) => console.error(err));
      }
    },
    [resetCode, toGrafana]
  );

  const changeView = useCallback((showDefaultPasswordWarning: boolean) => {
    setIsChangingPassword(true);
    setShowDefaultPasswordWarning(showDefaultPasswordWarning);
  }, []);

  const login = useCallback(
    (formModel: FormModel) => {
      setLoginErrorMessage(undefined);
      setIsLoggingIn(true);

      getBackendSrv()
        .post<LoginDTO>('/login', formModel, { showErrorAlert: false })
        .then((result) => {
          setResult(result);
          if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
            toGrafana();
            return;
          } else {
            changeView(formModel.password === 'admin');
          }
        })
        .catch((err) => {
          const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
          setIsLoggingIn(false);
          setLoginErrorMessage(fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'));
        });
    },
    [toGrafana, changeView]
  );

  const passwordlessStart = useCallback((formModel: PasswordlessFormModel) => {
    setLoginErrorMessage(undefined);
    setIsLoggingIn(true);

    getBackendSrv()
      .post<AuthNRedirectDTO>('/api/login/passwordless/start', formModel, { showErrorAlert: false })
      .then((result) => {
        window.location.assign(result.URL);
        return;
      })
      .catch((err) => {
        const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
        setIsLoggingIn(false);
        setLoginErrorMessage(fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'));
      });
  }, []);

  const passwordlessConfirm = useCallback(
    (formModel: PasswordlessConfirmationFormModel) => {
      setLoginErrorMessage(undefined);
      setIsLoggingIn(true);

      getBackendSrv()
        .post<LoginDTO>('/api/login/passwordless/authenticate', formModel, { showErrorAlert: false })
        .then((result) => {
          setResult(result);
          toGrafana();
          return;
        })
        .catch((err) => {
          const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
          setIsLoggingIn(false);
          setLoginErrorMessage(fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'));
        });
    },
    [toGrafana]
  );

  const { loginHint, passwordHint, disableLoginForm, disableUserSignUp } = config;

  return (
    <>
      {children({
        isOauthEnabled: isOauthEnabled(),
        loginHint,
        passwordHint,
        disableLoginForm,
        disableUserSignUp,
        login,
        passwordlessStart,
        passwordlessConfirm,
        showPasswordlessConfirmation: showPasswordlessConfirmation(),
        isLoggingIn,
        changePassword,
        skipPasswordChange: toGrafana,
        isChangingPassword,
        showDefaultPasswordWarning,
        loginErrorMessage,
      })}
    </>
  );
});

LoginCtrl.displayName = 'LoginCtrl';

export default LoginCtrl;

function getErrorMessage(err: FetchError<undefined | { messageId?: string; message?: string }>): string | undefined {
  switch (err.data?.messageId) {
    case 'password-auth.empty':
    case 'password-auth.failed':
    case 'password-auth.invalid':
      return t('login.error.invalid-user-or-password', 'Invalid username or password');
    case 'login-attempt.blocked':
      return t(
        'login.error.blocked',
        'You have exceeded the number of login attempts for this user. Please try again later.'
      );
    default:
      return err.data?.message;
  }
}

function getBootDataErrMessage(str?: string) {
  switch (str) {
    case 'oauth.login.error':
      return t('oauth.login.error', 'Login provider denied login request');
    default:
      return str;
  }
}
