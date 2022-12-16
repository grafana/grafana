import { css, cx } from '@emotion/css';
import { pickBy } from 'lodash';
import React from 'react';

import { GrafanaTheme2, DEFAULT_SAML_NAME } from '@grafana/data';
import { Icon, IconName, LinkButton, useStyles2, useTheme2, VerticalGroup } from '@grafana/ui';
import config from 'app/core/config';

export interface LoginService {
  bgColor: string;
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
      enabled: config.samlEnabled,
      name: config.samlName || DEFAULT_SAML_NAME,
      icon: 'key-skeleton-alt',
    },
    google: {
      bgColor: '#e84d3c',
      enabled: oauthEnabled && Boolean(config.oauth.google),
      name: 'Google',
      icon: 'google',
    },
    azuread: {
      bgColor: '#2f2f2f',
      enabled: oauthEnabled && Boolean(config.oauth.azuread),
      name: 'Microsoft',
      icon: 'microsoft',
    },
    github: {
      bgColor: '#464646',
      enabled: oauthEnabled && Boolean(config.oauth.github),
      name: 'GitHub',
      icon: 'github',
    },
    gitlab: {
      bgColor: '#fc6d26',
      enabled: oauthEnabled && Boolean(config.oauth.gitlab),
      name: 'GitLab',
      icon: 'gitlab',
    },
    grafanacom: {
      bgColor: '#262628',
      enabled: oauthEnabled && Boolean(config.oauth.grafana_com),
      name: 'Grafana.com',
      icon: 'grafana',
      hrefName: 'grafana_com',
    },
    okta: {
      bgColor: '#2f2f2f',
      enabled: oauthEnabled && Boolean(config.oauth.okta),
      name: config.oauth?.okta?.name || 'Okta',
      icon: config.oauth?.okta?.icon ?? ('okta' as const),
    },
    oauth: {
      bgColor: '#262628',
      enabled: oauthEnabled && Boolean(config.oauth.generic_oauth),
      name: config.oauth?.generic_oauth?.name || 'OAuth',
      icon: config.oauth?.generic_oauth?.icon ?? ('signin' as const),
      hrefName: 'generic_oauth',
    },
  };
};

const getServiceStyles = (theme: GrafanaTheme2) => {
  return {
    button: css`
      color: #d8d9da;
      position: relative;
    `,
    buttonIcon: css`
      position: absolute;
      left: ${theme.spacing(1)};
      top: 50%;
      transform: translateY(-50%);
    `,
    divider: {
      base: css`
        color: ${theme.colors.text};
        display: flex;
        margin-bottom: ${theme.spacing(1)};
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
  const styles = useStyles2(getServiceStyles);
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

function getButtonStyleFor(service: LoginService, styles: ReturnType<typeof getServiceStyles>, theme: GrafanaTheme2) {
  return cx(
    styles.button,
    css`
      background-color: ${service.bgColor};
      color: ${theme.colors.getContrastText(service.bgColor)};

      &:hover {
        background-color: ${theme.colors.emphasize(service.bgColor, 0.15)};
        box-shadow: ${theme.shadows.z1};
      }
    `
  );
}

export const LoginServiceButtons = () => {
  const enabledServices = pickBy(loginServices(), (service) => service.enabled);
  const hasServices = Object.keys(enabledServices).length > 0;
  const theme = useTheme2();
  const styles = useStyles2(getServiceStyles);

  if (hasServices) {
    return (
      <VerticalGroup>
        <LoginDivider />
        {Object.entries(enabledServices).map(([key, service]) => (
          <LinkButton
            key={key}
            className={getButtonStyleFor(service, styles, theme)}
            href={`login/${service.hrefName ? service.hrefName : key}`}
            target="_self"
            fullWidth
          >
            <Icon className={styles.buttonIcon} name={service.icon} />
            Sign in with {service.name}
          </LinkButton>
        ))}
      </VerticalGroup>
    );
  }

  return null;
};
