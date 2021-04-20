import React from 'react';
import config from 'app/core/config';
import { css, cx } from '@emotion/css';
import { Icon, IconName, LinkButton, useStyles, VerticalGroup } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { pickBy } from 'lodash';

export interface LoginService {
  bgColor: string;
  borderColor: string;
  enabled: boolean;
  name: string;
  hrefName?: string;
  icon: IconName;
}

export interface LoginServices {
  [key: string]: LoginService;
}

const loginServices: () => LoginServices = () => {
  const oauthEnabled = !!config.oauth;

  return {
    saml: {
      bgColor: '#464646',
      borderColor: '#393939',
      enabled: config.samlEnabled,
      name: 'SAML',
      icon: 'key-skeleton-alt',
    },
    google: {
      bgColor: '#e84d3c',
      borderColor: '#b83e31',
      enabled: oauthEnabled && config.oauth.google,
      name: 'Google',
      icon: 'google',
    },
    azuread: {
      bgColor: '#2f2f2f',
      borderColor: '#2f2f2f',
      enabled: oauthEnabled && config.oauth.azuread,
      name: 'Microsoft',
      icon: 'microsoft',
    },
    github: {
      bgColor: '#464646',
      borderColor: '#393939',
      enabled: oauthEnabled && config.oauth.github,
      name: 'GitHub',
      icon: 'github',
    },
    gitlab: {
      bgColor: '#fc6d26',
      borderColor: '#e24329',
      enabled: oauthEnabled && config.oauth.gitlab,
      name: 'GitLab',
      icon: 'gitlab',
    },
    grafanacom: {
      bgColor: '#262628',
      borderColor: '#393939',
      enabled: oauthEnabled && config.oauth.grafana_com,
      name: 'Grafana.com',
      hrefName: 'grafana_com',
      icon: 'grafana',
    },
    okta: {
      bgColor: '#2f2f2f',
      borderColor: '#393939',
      enabled: oauthEnabled && config.oauth.okta,
      name: 'Okta',
      icon: 'okta',
    },
    oauth: {
      bgColor: '#262628',
      borderColor: '#393939',
      enabled: oauthEnabled && config.oauth.generic_oauth,
      name: oauthEnabled && config.oauth.generic_oauth ? config.oauth.generic_oauth.name : 'OAuth',
      icon: 'signin',
      hrefName: 'generic_oauth',
    },
  };
};

const getServiceStyles = (theme: GrafanaTheme) => {
  return {
    button: css`
      color: #d8d9da;
      position: relative;
    `,
    buttonIcon: css`
      position: absolute;
      left: ${theme.spacing.sm};
      top: 50%;
      transform: translateY(-50%);
    `,
    divider: {
      base: css`
        color: ${theme.colors.text};
        display: flex;
        margin-bottom: ${theme.spacing.sm};
        justify-content: space-between;
        text-align: center;
        width: 100%;
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
  const enabledServices = pickBy(loginServices(), (service) => service.enabled);
  const hasServices = Object.keys(enabledServices).length > 0;
  const styles = useStyles(getServiceStyles);

  if (hasServices) {
    return (
      <VerticalGroup>
        <LoginDivider />
        {Object.entries(enabledServices).map(([key, service]) => (
          <LinkButton
            key={key}
            className={cx(
              styles.button,
              css`
                background-color: ${service.bgColor};
                border-color: ${service.borderColor};
                &:hover {
                  background-color: ${service.bgColor};
                }
              `
            )}
            href={`login/${service.hrefName ? service.hrefName : key}`}
            target="_self"
            fullWidth
          >
            <Icon
              className={cx(
                styles.buttonIcon,
                css`
                  border-color: ${service.borderColor};
                `
              )}
              name={service.icon}
            />
            Sign in with {service.name}
          </LinkButton>
        ))}
      </VerticalGroup>
    );
  }

  return null;
};
