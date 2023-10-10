import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

const FOOTER_URL = 'https://grafana.com/?src=grafananet&cnt=public-dashboards';
const GRAFANA_LOGO_LIGHT_URL = 'public/img/grafana_text_logo_light.svg';
const GRAFANA_LOGO_DARK_URL = 'public/img/grafana_text_logo_dark.svg';

export interface PublicDashboardCfg {
  footerHide: boolean;
  footerText: React.ReactNode;
  footerLogo: string;
  footerLink: string;
  headerLogoHide: boolean;
}
const useGetConfig = (cfg?: PublicDashboardCfg) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const { footerHide, footerText, footerLink, footerLogo, headerLogoHide } = cfg || {
    footerHide: false,
    footerText: 'Powered by',
    footerLogo: theme.isDark ? 'public/img/grafana_text_logo_light.svg' : 'public/img/grafana_text_logo_dark.svg',
    footerLink: FOOTER_URL,
    headerLogoHide: false,
  };

  return {
    footerHide,
    footerText: <span className={styles.text}>{footerText}</span>,
    footerLogo: [GRAFANA_LOGO_LIGHT_URL, GRAFANA_LOGO_DARK_URL].includes(footerLogo)
      ? theme.isDark
        ? GRAFANA_LOGO_LIGHT_URL
        : GRAFANA_LOGO_DARK_URL
      : footerLogo,
    footerLink,
    headerLogoHide,
  };
};
export let useGetPublicDashboardConfig = (): PublicDashboardCfg => useGetConfig();

export function setPublicDashboardConfigFn(cfg: PublicDashboardCfg) {
  useGetPublicDashboardConfig = (): PublicDashboardCfg => useGetConfig(cfg);
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
  }),
});
