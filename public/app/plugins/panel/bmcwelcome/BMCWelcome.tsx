import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme, PanelProps } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

import { HelpCards } from './HelpCards';
import { Options } from './types';

export interface BMCWelcomeBannerProps extends PanelProps<Options> {}

export const BMCWelcomeBanner: FC<BMCWelcomeBannerProps> = ({ options }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const bmcHelixLogoForLightTheme = 'logo-helix';
  const bmcHelixLogoForDarkTheme = 'logo-helix logo-light';
  const bmcHelixLogo = theme.isDark ? bmcHelixLogoForDarkTheme : bmcHelixLogoForLightTheme;

  const defaultLightLogo = 'public/img/bmc_helix_light.svg';
  const defaultDarkLogo = 'public/img/bmc_helix_dark.svg';
  const defaultBMCHelixLogo = theme.isDark ? defaultDarkLogo : defaultLightLogo;

  const featureFlagged = getFeatureStatus('branding');
  return (
    <div className={styles.container}>
      <div className={styles.logoContainer}>
        <div
          id="bmcHelixLogoTitle"
          className={featureFlagged ? bmcHelixLogo : styles.logo}
          style={{
            width: '110px',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center right',
            ...(!featureFlagged ? { backgroundImage: `url(${defaultBMCHelixLogo})` } : {}),
          }}
          aria-labelledby="bmcHelixLogoTitle"
        >
          <title id="bmcHelixLogoTitle">BMC Helix Logo</title>
        </div>
        <div className={styles.logoText}> Dashboards</div>
      </div>
      <div className={styles.help}>
        <HelpCards options={options} />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      background-size: cover;
      height: 100%;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing.md};

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        flex-direction: column;
        align-items: flex-start;
        padding-bottom: ${theme.spacing.xs};
      }
    `,
    logoText: css`
      font-size: 1.3125rem;
      line-height: 1.875rem;
      font-weight: 200;
      padding: 0 10px;
      font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
    `,
    logoContainer: css`
      display: flex;
      flex: 0 0 auto;
      flex-flow: row;
      padding-right: 15px;
      align-items: center;
      justify-content: center;
      font-size: 1.3125rem;
      line-height: 1.875rem;
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        margin: ${theme.spacing.xl} 0 0 0;
      }
    `,
    logo: css`
      margin-right: 5px;
      :before {
        content: '';
        width: inherit;
        display: inline-block;
        vertical-align: bottom;
      }
    `,
    help: css`
      display: flex;
      overflow-x: auto;
      overflow-y: hidden;
      align-items: center;
      justify-content: flex-start;
      margin-top: 10px;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        width: 100%;
      }
    `,
  };
});
