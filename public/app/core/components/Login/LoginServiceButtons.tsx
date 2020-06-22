import React from 'react';
import config from 'app/core/config';
import { css, cx } from 'emotion';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

const loginServices: () => LoginServices = () => {
  const oauthEnabled = !!config.oauth;

  return {
    saml: {
      enabled: config.samlEnabled,
      name: 'SAML',
      className: 'github',
      icon: 'key',
    },
    google: {
      enabled: oauthEnabled && config.oauth.google,
      name: 'Google',
    },
    azuread: {
      enabled: oauthEnabled && config.oauth.azuread,
      name: 'Microsoft',
    },
    github: {
      enabled: oauthEnabled && config.oauth.github,
      name: 'GitHub',
    },
    gitlab: {
      enabled: oauthEnabled && config.oauth.gitlab,
      name: 'GitLab',
    },
    grafanacom: {
      enabled: oauthEnabled && config.oauth.grafana_com,
      name: 'Grafana.com',
      hrefName: 'grafana_com',
      icon: 'grafana_com',
    },
    okta: {
      enabled: oauthEnabled && config.oauth.okta,
      name: 'Okta',
    },
    oauth: {
      enabled: oauthEnabled && config.oauth.generic_oauth,
      name: oauthEnabled && config.oauth.generic_oauth ? config.oauth.generic_oauth.name : 'OAuth',
      icon: 'sign-in',
      hrefName: 'generic_oauth',
    },
  };
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

const getServiceStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      width: 100%;
      text-align: center;
    `,
    button: css`
      color: #d8d9da;
      margin: 0 0 ${theme.spacing.md};
      width: 100%;
      &:hover {
        color: #fff;
      }
    `,
    divider: {
      base: css`
        float: left;
        width: 100%;
        margin: 0 25% ${theme.spacing.md} 25%;
        display: flex;
        justify-content: space-between;
        text-align: center;
        color: ${theme.colors.text};
      `,
      line: css`
        width: 100px;
        height: 10px;
        border-bottom: 1px solid ${theme.colors.text};
      `,
    },
  };
};

const LoginDivider = () => {
  const styles = useStyles(getServiceStyles);
  return (
    <>
      <div className={styles.divider.base}>
        <div>
          <div className={styles.divider.line} />
        </div>
        <div>
          <span>{!config.disableLoginForm && <span>or</span>}</span>
        </div>
        <div>
          <div className={styles.divider.line} />
        </div>
      </div>
      <div className="clearfix" />
    </>
  );
};

export const LoginServiceButtons = () => {
  const styles = useStyles(getServiceStyles);
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
        className={cx(`btn btn-medium btn-service btn-service--${service.className || key}`, styles.button)}
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
      <div className={styles.container}>{serviceElements}</div>
    </>
  );
};
