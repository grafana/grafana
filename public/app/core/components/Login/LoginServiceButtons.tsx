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
    name: 'OAuth',
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

export const LoginServiceButtons = () => {
  const keyNames = Object.keys(loginServices());
  const serviceElements = keyNames.map(key => {
    const service: LoginService = loginServices()[key];
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

  return <div className="login-oauth text-center">{serviceElements}</div>;
};
