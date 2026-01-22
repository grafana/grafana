import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { useGetPublicDashboardConfig } from './usePublicDashboardConfig';

const selectors = e2eSelectors.pages.PublicDashboard;

export interface PublicDashboardFooterProps {
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
}

export const PublicDashboardFooter = function ({ paddingX, useMinHeight, linkUrl }: PublicDashboardFooterProps) {
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

  return conf.footerHide ? null : (
    <div className={cx(styles.footer, footerVariantClassName)} data-testid={selectors.footer}>
      <a className={styles.link} href={linkUrl ?? conf.footerLink} target="_blank" rel="noreferrer noopener">
        {conf.footerText} <img className={styles.logoImg} alt="" src={conf.footerLogo} />
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
});
