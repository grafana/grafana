import React, { PureComponent } from 'react';
import config from 'app/core/config';

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
}

export class LoginForm extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
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
    console.log(config.oauth);
    return <div>{this.renderLoginServices(loginServices)}</div>;
  }
}
