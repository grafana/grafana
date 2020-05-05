import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { ButtonSelect, stylesFactory, useTheme } from '@grafana/ui';

const helpOptions = [
  { value: 0, label: 'Documentation', href: 'https://grafana.com/docs/grafana/latest/' },
  { value: 1, label: 'Tutorials', href: 'https://grafana.com/tutorials/' },
  { value: 2, label: 'Community', href: 'https://community.grafana.com/' },
  { value: 3, label: 'Public Slack', href: '' },
];

export const WelcomeBanner = () => {
  const styles = getStyles(useTheme());

  return (
    <div className={styles.container}>
      <h1>Welcome to Grafana</h1>
      <div className={styles.help}>
        <h3>Need help?</h3>
        <ButtonSelect
          defaultValue={helpOptions[0]}
          variant="secondary"
          className={styles.smallScreenHelp}
          onChange={onHelpLinkClick}
          options={helpOptions}
        />
        <div className={styles.helpLinks}>
          {helpOptions.map((option, index) => {
            return (
              <a key={`${option.label}-${index}`} className={styles.helpLink} href={option.href}>
                {option.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const onHelpLinkClick = (option: { label: string; href: string }) => {
  window.open(option.href, '_blank');
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const backgrundImage = theme.isDark ? 'public/img/onboarding_art_dark.svg' : 'public/img/onboarding_art_light.svg';
  return {
    container: css`
      display: flex;
      background: url(${backgrundImage}) no-repeat;
      background-size: cover;
      height: 100%;
      align-items: center;
      padding: 0 50px 0 140px;
      justify-content: space-between;

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        padding: 0 24px 0 100px;
      }
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        flex-direction: column;
        padding: 8px;
      }
    `,
    help: css`
      display: flex;
      align-items: baseline;
    `,
    helpLinks: css`
      margin-left: 24px;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: none;
      }
    `,
    helpLink: css`
      margin-left: 16px;
      text-decoration: underline;
    `,
    smallScreenHelp: css`
      @media only screen and (min-width: ${theme.breakpoints.lg}) {
        display: none;
      }
    `,
  };
});
