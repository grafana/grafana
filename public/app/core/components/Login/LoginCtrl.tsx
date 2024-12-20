import { PureComponent } from 'react';

import { FetchError, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';

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

interface State {
  isLoggingIn: boolean;
  isChangingPassword: boolean;
  showDefaultPasswordWarning: boolean;
  loginErrorMessage?: string;
}

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
          loginErrorMessage: fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'),
        });
      });
  };

  passwordlessStart = (formModel: PasswordlessFormModel) => {
    this.setState({
      loginErrorMessage: undefined,
      isLoggingIn: true,
    });

    getBackendSrv()
      .post<AuthNRedirectDTO>('/api/login/passwordless/start', formModel, { showErrorAlert: false })
      .then((result) => {
        window.location.assign(result.URL);
        return;
      })
      .catch((err) => {
        const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
        this.setState({
          isLoggingIn: false,
          loginErrorMessage: fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'),
        });
      });
  };

  passwordlessConfirm = (formModel: PasswordlessConfirmationFormModel) => {
    this.setState({
      loginErrorMessage: undefined,
      isLoggingIn: true,
    });

    getBackendSrv()
      .post<LoginDTO>('/api/login/passwordless/authenticate', formModel, { showErrorAlert: false })
      .then((result) => {
        this.result = result;
        this.toGrafana();
        return;
      })
      .catch((err) => {
        const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
        this.setState({
          isLoggingIn: false,
          loginErrorMessage: fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'),
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
    if (config.featureToggles.useSessionStorageForRedirection) {
      window.location.assign(config.appSubUrl + '/');
      return;
    }

    if (this.result?.redirectUrl) {
      if (config.appSubUrl !== '' && !this.result.redirectUrl.startsWith(config.appSubUrl)) {
        window.location.assign(config.appSubUrl + this.result.redirectUrl);
      } else {
        window.location.assign(this.result.redirectUrl);
      }
    } else {
      window.location.assign(config.appSubUrl + '/');
    }
  };

  render() {
    const { children } = this.props;
    const { isLoggingIn, isChangingPassword, showDefaultPasswordWarning, loginErrorMessage } = this.state;
    const { login, toGrafana, changePassword, passwordlessStart, passwordlessConfirm } = this;
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
  }
}

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
