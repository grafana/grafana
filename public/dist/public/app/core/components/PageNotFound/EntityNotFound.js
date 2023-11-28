import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
export function EntityNotFound({ entity = 'Page' }) {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    return (React.createElement("div", { className: styles.container },
        React.createElement("h1", null,
            entity,
            " not found"),
        React.createElement("div", { className: styles.subtitle },
            "We're looking but can't seem to find this ",
            entity.toLowerCase(),
            ". Try returning",
            ' ',
            React.createElement("a", { href: "/", className: "external-link" }, "home"),
            ' ',
            "or seeking help on the",
            ' ',
            React.createElement("a", { href: "https://community.grafana.com", target: "_blank", rel: "noreferrer", className: "external-link" }, "community site.")),
        React.createElement("div", { className: styles.grot },
            React.createElement("img", { src: `public/img/grot-404-${theme.isDark ? 'dark' : 'light'}.svg`, width: "100%", alt: "grot" }))));
}
export function getStyles(theme) {
    return {
        container: css({
            display: 'flex',
            flexDirection: 'column',
            padding: theme.spacing(8, 2, 2, 2),
            h1: {
                textAlign: 'center',
            },
        }),
        subtitle: css({
            color: theme.colors.text.secondary,
            fontSize: theme.typography.h5.fontSize,
            padding: theme.spacing(2, 0),
            textAlign: 'center',
        }),
        grot: css({
            maxWidth: '450px',
            paddingTop: theme.spacing(8),
            margin: '0 auto',
        }),
    };
}
//# sourceMappingURL=EntityNotFound.js.map