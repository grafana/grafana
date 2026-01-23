import { css, cx } from '@emotion/css';
import i18n from 'i18next';
import { useMemo } from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { useStyles2, useTheme2 } from '@grafana/ui';
import grafanaTextLogoDarkSvg from 'img/grafana_text_logo_dark.svg';
import grafanaTextLogoLightSvg from 'img/grafana_text_logo_light.svg';

import { useGetPublicDashboardConfig } from './usePublicDashboardConfig';

const selectors = e2eSelectors.pages.PublicDashboard;
const DEFAULT_GRAFANA_LOGO_TOKEN = 'grafana-logo';

export enum DashboardBrandingFooterVariant {
  Public = 'public',
  Kiosk = 'kiosk',
}

export interface DashboardBrandingFooterProps {
  /**
   * Predefined variants for common use cases.
   * - `Public`: uses public dashboard configuration defaults.
   * - `Kiosk`: uses Grafana defaults to avoid inheriting public dashboard branding overrides.
   */
  variant?: DashboardBrandingFooterVariant;

  /**
   * Applies horizontal padding to the footer container.
   * Useful when rendering the footer in layouts that don't already have page padding (e.g. kiosk mode).
   */
  paddingX?: number;
  /**
   * When true, avoids clipping in containers with `overflow: hidden` by not relying on a fixed height.
   */
  useMinHeight?: boolean;
  /**
   * Overrides the CTA link URL.
   * Useful when reusing the footer outside public dashboards.
   */
  linkUrl?: string;

  /**
   * Overrides the footer text. When omitted, uses the configured public dashboard footer text.
   */
  text?: React.ReactNode;

  /**
   * Overrides the footer logo URL.
   *
   * - Use `'grafana-logo'` to render the default Grafana text logo (light/dark chosen based on theme).
   * - Use an empty string to hide the logo.
   * - When omitted, uses the configured public dashboard footer logo.
   */
  logo?: string;

  /**
   * Hides the footer regardless of config.
   */
  hide?: boolean;
}

export const DashboardBrandingFooter = function ({
  variant = DashboardBrandingFooterVariant.Public,
  paddingX,
  useMinHeight,
  linkUrl,
  text,
  logo,
  hide,
}: DashboardBrandingFooterProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const conf = useGetPublicDashboardConfig();

  const footerVariantClassName = useMemo(() => {
    return cx({
      [css({
        boxSizing: 'border-box',
        paddingLeft: theme.spacing(paddingX ?? 0),
        paddingRight: theme.spacing(paddingX ?? 0),
      })]: paddingX !== undefined,
      [css({
        height: 'auto',
        minHeight: '30px',
        alignItems: 'center',
      })]: Boolean(useMinHeight),
    });
  }, [paddingX, theme, useMinHeight]);

  if (hide || conf.footerHide) {
    return null;
  }

  const href = textUtil.sanitizeUrl(linkUrl ?? conf.footerLink);
  const defaultText =
    variant === DashboardBrandingFooterVariant.Kiosk
      ? i18n.t('dashboard.kiosk.footerPoweredBy', 'Powered by')
      : undefined;
  const defaultLogo = variant === DashboardBrandingFooterVariant.Kiosk ? DEFAULT_GRAFANA_LOGO_TOKEN : undefined;

  const footerText =
    text !== undefined ? (
      <span className={styles.text}>{text}</span>
    ) : defaultText !== undefined ? (
      <span className={styles.text}>{defaultText}</span>
    ) : (
      conf.footerText
    );

  const footerLogo = logo !== undefined ? logo : defaultLogo !== undefined ? defaultLogo : conf.footerLogo;
  const resolvedLogo =
    footerLogo === DEFAULT_GRAFANA_LOGO_TOKEN
      ? theme.isDark
        ? grafanaTextLogoLightSvg
        : grafanaTextLogoDarkSvg
      : footerLogo;
  const logoSrc = resolvedLogo ? textUtil.sanitizeUrl(resolvedLogo) : '';

  return (
    <div className={cx(styles.footer, footerVariantClassName)} data-testid={selectors.footer}>
      <a className={styles.link} href={href} target="_blank" rel="noreferrer noopener">
        {footerText} {logoSrc ? <img className={styles.logoImg} alt="" src={logoSrc} /> : null}
      </a>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css({
    display: 'flex',
    justifyContent: 'end',
    height: '30px',
    backgroundColor: theme.colors.background.canvas,
    position: 'sticky',
    bottom: 0,
    zIndex: theme.zIndex.navbarFixed,
    padding: theme.spacing(0.5, 0),
  }),
  link: css({
    display: 'flex',
    alignItems: 'center',
  }),
  logoImg: css({
    height: '16px',
    marginLeft: theme.spacing(0.5),
  }),
  text: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
  }),
});
