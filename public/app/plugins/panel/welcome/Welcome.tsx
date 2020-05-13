import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';
import lightBackground from './img/background_light.svg';

const helpOptions = [
  { value: 0, label: 'Documentation', href: 'https://grafana.com/docs/grafana/latest' },
  { value: 1, label: 'Tutorials', href: 'https://grafana.com/tutorials' },
  { value: 2, label: 'Community', href: 'https://community.grafana.com' },
  { value: 3, label: 'Public Slack', href: 'http://slack.grafana.com' },
];

export const WelcomeBanner: FC = () => {
  const styles = getStyles(useTheme());

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Grafana</h1>
      <div className={styles.help}>
        <h3 className={styles.helpText}>Need help?</h3>
        <div className={styles.helpLinks}>
          {helpOptions.map((option, index) => {
            return (
              <a
                key={`${option.label}-${index}`}
                className={styles.helpLink}
                href={`${option.href}?utm_source=grafana_gettingstarted`}
              >
                {option.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const backgroundImage = theme.isDark ? 'public/img/login_background_dark.svg' : lightBackground;

  return {
    container: css`
      display: flex;
      background: url(${backgroundImage}) no-repeat;
      background-size: cover;
      height: 100%;
      align-items: center;
      padding: 0 16px;
      justify-content: space-between;
      padding: 0 ${theme.spacing.lg};

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        background-position: 0px;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
      }

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        padding: 0 ${theme.spacing.sm};
      }
    `,
    title: css`
      margin-bottom: 0;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        margin-bottom: ${theme.spacing.sm};
      }

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        font-size: ${theme.typography.heading.h2};
      }
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        font-size: ${theme.typography.heading.h3};
      }
    `,
    help: css`
      display: flex;
      align-items: baseline;
    `,
    helpText: css`
      margin-right: ${theme.spacing.md};
      margin-bottom: 0;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        font-size: ${theme.typography.heading.h4};
      }

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        display: none;
      }
    `,
    helpLinks: css`
      display: flex;
      flex-wrap: wrap;
    `,
    helpLink: css`
      margin-right: ${theme.spacing.md};
      text-decoration: underline;
      text-wrap: no-wrap;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        margin-right: 8px;
      }
    `,
  };
});
