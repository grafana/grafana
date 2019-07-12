import React, { PureComponent } from 'react';
import config from 'app/core/config';
import { UserSignup } from './UserSignup';

const loginServices: LoginServices = {
  saml: {
    enabled: config.samlEnabled,
    name: 'SAML',
    className: 'github',
    icon: 'key',
  },
  google: {
    enabled: config.oauth.google,
    name: 'Google',
  },
  github: {
    enabled: config.oauth.github,
    name: 'GitHub',
  },
  gitlab: {
    enabled: config.oauth.gitlab,
    name: 'GitLab',
  },
  grafanacom: {
    enabled: config.oauth.grafana_com,
    name: 'Grafana.com',
    hrefName: 'grafana_com',
    icon: 'grafana_com',
  },
  oauth: {
    enabled: config.oauth.generic_oauth,
    name: 'OAuth',
    icon: 'sign-in',
    hrefName: 'generic_oauth',
  },
};

const oauthEnabled = Object.keys(config.oauth).length > 0;

export interface LoginService {
  enabled: boolean;
  name: string;
  hrefName?: string;
  icon?: string;
  className?: string;
}

export interface LoginServices {
  [key: string]: LoginService;
}

export interface EnabledLoginServices {
  saml: boolean;
  google: boolean;
  github: boolean;
  gitlab: boolean;
  grafanacom: boolean;
  oauth: boolean;
}

export interface Props {
  disabledLoginForm: boolean;
  passwordHint: string;
  loginHint: string;
  disableUserSignup: boolean;
  oauthEnabled: boolean;
  ldapEnabled: boolean;
  authProxyEnabled: boolean;
  loginServices: EnabledLoginServices;
  onSubmit: Function;
}

export interface State {
  loggingIn: boolean;
  user: string;
  password: string;
  email: string;
  valid: boolean;
}

export class LoginForm extends PureComponent<Props, State> {
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

  handleSubmit() {}

  renderLoginForm() {
    return !this.props.disabledLoginForm ? (
      <form name="loginForm" className="login-form-group gf-form-group">
        <div className="login-form">
          <input
            type="text"
            name="username"
            className="gf-form-input login-form-input"
            required
            // ng-model="formModel.user"
            placeholder={config.loginHint}
            aria-label="Username input field"
          />
        </div>
        <div className="login-form">
          <input
            type="password"
            name="password"
            className="gf-form-input login-form-input"
            required
            ng-model="formModel.password"
            id="inputPassword"
            placeholder={config.passwordHint}
            aria-label="Password input field"
          />
        </div>
        <div className="login-button-group">
          {!this.state.loggingIn ? (
            <button
              type="submit"
              aria-label="Login button"
              className={`btn btn-large p-x-2 ${this.state.valid ? 'btn-primary' : 'btn-inverse'}`}
              onClick={this.handleSubmit}
            >
              Log In
            </button>
          ) : (
            <button type="submit" className="btn btn-large p-x-2 btn-inverse btn-loading">
              Logging In<span>.</span>
              <span>.</span>
              <span>.</span>
            </button>
          )}

          {config.ldapEnabled || config.authProxyEnabled ? null : (
            <div className="small login-button-forgot-password" ng-hide="ldapEnabled || authProxyEnabled">
              <a href="user/password/send-reset-email">Forgot your password?</a>
            </div>
          )}
        </div>
      </form>
    ) : null;
  }

  renderLoginServices(loginServices: LoginServices) {
    const keyNames = Object.keys(loginServices);
    return keyNames.map((key, i: number) => {
      const service: LoginService = loginServices[key];
      return service.enabled ? (
        <a
          key={key}
          className={`btn btn-medium btn-service btn-service--${service.className || key} login-btn`}
          href={`login/${service.hrefName ? service.hrefName : key}`}
          target="_self"
        >
          <i className={`btn-service-icon fa fa-${service.icon ? service.icon : key}`} />
          Sign in with {service.name}
        </a>
      ) : null;
    });
  }

  render() {
    return (
      <div className="login-out-box">
        <div className="login-inner-box" id="login-view">
          {config.disableLoginForm ? null : this.renderLoginForm()}
          {oauthEnabled ? (
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
              <div className="login-oauth text-center">{this.renderLoginServices(loginServices)}</div>
            </>
          ) : null}

          <UserSignup />
        </div>
      </div>
    );
  }
}
