import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { useGetPublicDashboardConfig } from './usePublicDashboardConfig';
export const PublicDashboardFooter = function () {
    const styles = useStyles2(getStyles);
    const conf = useGetPublicDashboardConfig();
    return conf.footerHide ? null : (React.createElement("div", { className: styles.footer },
        React.createElement("a", { className: styles.link, href: conf.footerLink, target: "_blank", rel: "noreferrer noopener" },
            conf.footerText,
            " ",
            React.createElement("img", { className: styles.logoImg, alt: "", src: conf.footerLogo }))));
};
const getStyles = (theme) => ({
    footer: css({
        display: 'flex',
        justifyContent: 'end',
        height: '30px',
        padding: theme.spacing(0, 2, 0, 1),
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
//# sourceMappingURL=PublicDashboardsFooter.js.map