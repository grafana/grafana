import { css } from '@emotion/css';
import React from 'react';
import { Card, useStyles2 } from '@grafana/ui';
import { Grid } from '@grafana/ui/src/unstable';
import { PluginAngularBadge } from 'app/features/plugins/admin/components/Badges';
const getStyles = (theme) => ({
    heading: css({
        fontSize: theme.typography.h5.fontSize,
        fontWeight: 'inherit',
    }),
    figure: css({
        width: 'inherit',
        marginRight: '0px',
        '> img': {
            width: theme.spacing(7),
        },
    }),
    meta: css({
        marginTop: '6px',
        position: 'relative',
    }),
    description: css({
        margin: '0px',
        fontSize: theme.typography.bodySmall.fontSize,
    }),
    card: css({
        gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
    }),
    logo: css({
        marginRight: theme.spacing(3),
        marginLeft: theme.spacing(1),
        width: theme.spacing(7),
        maxHeight: theme.spacing(7),
    }),
});
export const CardGrid = ({ items, onClickItem }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Grid, { gap: 1.5, minColumnWidth: 44 }, items.map((item) => (React.createElement(Card, { key: item.id, className: styles.card, href: item.url, onClick: (e) => {
            if (onClickItem) {
                onClickItem(e, item);
            }
        } },
        React.createElement(Card.Heading, { className: styles.heading }, item.name),
        React.createElement(Card.Figure, { align: "center", className: styles.figure },
            React.createElement("img", { className: styles.logo, src: item.logo, alt: "" })),
        item.angularDetected ? (React.createElement(Card.Meta, { className: styles.meta },
            React.createElement(PluginAngularBadge, null))) : null)))));
};
//# sourceMappingURL=CardGrid.js.map