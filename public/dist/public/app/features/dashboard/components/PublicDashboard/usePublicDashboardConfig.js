import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
const FOOTER_URL = 'https://grafana.com/?src=grafananet&cnt=public-dashboards';
const GRAFANA_LOGO_LIGHT_URL = 'public/img/grafana_text_logo_light.svg';
const GRAFANA_LOGO_DARK_URL = 'public/img/grafana_text_logo_dark.svg';
const GRAFANA_LOGO_DEFAULT_VALUE = 'grafana-logo';
const useGetConfig = (cfg) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const { footerHide, footerText, footerLink, footerLogo, headerLogoHide } = cfg || {
        footerHide: false,
        footerText: 'Powered by',
        footerLogo: GRAFANA_LOGO_DEFAULT_VALUE,
        footerLink: FOOTER_URL,
        headerLogoHide: false,
    };
    return {
        footerHide,
        footerText: React.createElement("span", { className: styles.text }, footerText),
        footerLogo: footerLogo === GRAFANA_LOGO_DEFAULT_VALUE
            ? theme.isDark
                ? GRAFANA_LOGO_LIGHT_URL
                : GRAFANA_LOGO_DARK_URL
            : footerLogo,
        footerLink,
        headerLogoHide,
    };
};
export let useGetPublicDashboardConfig = () => useGetConfig();
export function setPublicDashboardConfigFn(cfg) {
    useGetPublicDashboardConfig = () => useGetConfig(cfg);
}
const getStyles = (theme) => ({
    text: css({
        color: theme.colors.text.secondary,
        fontSize: theme.typography.body.fontSize,
    }),
});
//# sourceMappingURL=usePublicDashboardConfig.js.map