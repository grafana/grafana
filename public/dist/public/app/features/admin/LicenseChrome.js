import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
const title = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };
const getStyles = (theme) => {
    const backgroundUrl = theme.isDark ? 'public/img/licensing/header_dark.svg' : 'public/img/licensing/header_light.svg';
    const footerBg = theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray6;
    return {
        container: css `
      padding: 36px 79px;
      background: ${theme.components.panel.background};
    `,
        footer: css `
      text-align: center;
      padding: 16px;
      background: ${footerBg};
    `,
        header: css `
      height: 137px;
      padding: 40px 0 0 79px;
      position: relative;
      background: url('${backgroundUrl}') right;
    `,
    };
};
export function LicenseChrome({ header, editionNotice, subheader, children }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.header },
            React.createElement("h2", { style: title }, header),
            subheader && React.createElement("h3", null, subheader),
            React.createElement(Circle, { size: "128px", style: {
                    boxShadow: '0px 0px 24px rgba(24, 58, 110, 0.45)',
                    background: '#0A1C36',
                    position: 'absolute',
                    top: '19px',
                    left: '71%',
                } },
                React.createElement("img", { src: "public/img/grafana_icon.svg", alt: "Grafana", width: "80px", style: { position: 'absolute', left: '23px', top: '20px' } }))),
        React.createElement("div", { className: styles.container }, children),
        editionNotice && React.createElement("div", { className: styles.footer }, editionNotice)));
}
export const Circle = ({ size, style, children }) => {
    const theme = useTheme2();
    return (React.createElement("div", { style: Object.assign({ width: size, height: size, position: 'absolute', bottom: 0, right: 0, borderRadius: theme.shape.radius.circle }, style) }, children));
};
//# sourceMappingURL=LicenseChrome.js.map