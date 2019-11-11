import React from 'react';
import config from 'app/core/config';

const loginServices: () => LoginServices = () => ({
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
    name: config.oauth.generic_oauth ? config.oauth.generic_oauth.name : 'OAuth',
    icon: 'sign-in',
    hrefName: 'generic_oauth',
  },
});

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

const LoginDivider = () => {
  return (
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
    </>
  );
};

export const LoginServiceButtons = () => {
  const keyNames = Object.keys(loginServices());
  const serviceElementsEnabled = keyNames.filter(key => {
    const service: LoginService = loginServices()[key];
    return service.enabled;
  });

  if (serviceElementsEnabled.length === 0) {
    return null;
  }

  const serviceElements = serviceElementsEnabled.map(key => {
    const service: LoginService = loginServices()[key];
    return (
      <a
        key={key}
        className={`btn btn-medium btn-service btn-service--${service.className || key} login-btn`}
        href={`login/${service.hrefName ? service.hrefName : key}`}
        target="_self"
      >
        <i className={`btn-service-icon fa fa-${service.icon ? service.icon : key}`} />
        Sign in with {service.name}
      </a>
    );
  });

  const divider = LoginDivider();
  return (
    <>
      {divider}
      <div className="login-oauth text-center">{serviceElements}</div>
    </>
  );
};
