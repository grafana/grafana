import { memo, useState, useCallback, type JSX } from 'react';

import { t } from '@grafana/i18n';
import { type FetchError, getBackendSrv, isFetchError } from '@grafana/runtime';
import config from 'app/core/config';

import { type LoginDTO } from './types';

const isOauthEnabled = () => {
  return !!config.oauth && Object.keys(config.oauth).length > 0;
};

export interface FormModel {
  user: string;
  password: string;
  email: string;
}

interface Props {
  resetCode?: string;

  children: (props: {
    isLoggingIn: boolean;
    changePassword: (pw: string) => void;
    isChangingPassword: boolean;
    skipPasswordChange: Function;
    login: (data: FormModel) => void;
    disableLoginForm: boolean;
    disableUserSignUp: boolean;
    isOauthEnabled: boolean;
    loginHint: string;
    passwordHint: string;
    showDefaultPasswordWarning: boolean;
    loginErrorMessage: string | undefined;
  }) => JSX.Element;
}

const LoginCtrl = memo(({ resetCode, children }: Props) => {
  const [result, setResult] = useState<LoginDTO | undefined>();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDefaultPasswordWarning, setShowDefaultPasswordWarning] = useState(false);
  // oAuth unauthorized sets the redirect error message in the bootdata, hence we need to check the key here
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | undefined>(
    getBootDataErrMessage(config.loginError)
  );

<<<<<<< HEAD
export class LoginCtrl extends PureComponent<Props, State> {
  result: LoginDTO | undefined;

  constructor(props: Props) {
    super(props);
    this.state = {
      isLoggingIn: false,
      isChangingPassword: false,
      showDefaultPasswordWarning: false,
      // oAuth unauthorized sets the redirect error message in the bootdata, hence we need to check the key here
      loginErrorMessage: getBootDataErrMessage(config.loginError),
    };
  }

  changePassword = (password: string) => {
    const pw = {
      newPassword: password,
      confirmNew: password,
      oldPassword: 'admin',
    };

    if (this.props.resetCode) {
      const resetModel = {
        code: this.props.resetCode,
        newPassword: password,
        confirmPassword: password,
      };

      getBackendSrv()
        .post('/api/user/password/reset', resetModel)
        .then(() => {
          this.toGrafana();
        });
    } else {
      getBackendSrv()
        .put('/api/user/password', pw)
        .then(() => {
          this.toGrafana();
        })
        .catch((err) => console.error(err));
    }
  };

  login = (formModel: FormModel) => {
    this.setState({
      loginErrorMessage: undefined,
      isLoggingIn: true,
    });

    getBackendSrv()
      .post<LoginDTO>('/login', formModel, { showErrorAlert: false })
      .then((result) => {
        this.result = result;
        if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
          this.toGrafana();
          return;
        } else {
          this.changeView(formModel.password === 'admin');
        }
      })
      .catch((err) => {
        const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
        this.setState({
          isLoggingIn: false,
          loginErrorMessage: fetchErrorMessage || 'Призошла неизвестная ошибка',
        });
      });
  };

  changeView = (showDefaultPasswordWarning: boolean) => {
    this.setState({
      isChangingPassword: true,
      showDefaultPasswordWarning,
    });
  };

  toGrafana = () => {
=======
  const toGrafana = useCallback(() => {
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
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
    async (formModel: FormModel) => {
      setLoginErrorMessage(undefined);
      setIsLoggingIn(true);

      return getBackendSrv()
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
      return 'Неверное имя пользователя или пароль';
    case 'login-attempt.blocked':
      return 'Вы превысили количество попыток входа в систему для этого пользователя. Пожалуйста, повторите попытку позже.';
    default:
      return err.data?.message;
  }
}

function getBootDataErrMessage(str?: string) {
  switch (str) {
    case 'oauth.login.error':
      return 'Поставщик услуг входа отклонил запрос на вход в систему';
    default:
      return str;
  }
}
