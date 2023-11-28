import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Card, LinkButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
export function DataSourceTypeCard({ onClick, dataSourcePlugin }) {
    var _a, _b, _c;
    const isPhantom = dataSourcePlugin.module === 'phantom';
    const isClickable = !isPhantom && !dataSourcePlugin.unlicensed;
    const learnMoreLink = ((_b = (_a = dataSourcePlugin.info) === null || _a === void 0 ? void 0 : _a.links) === null || _b === void 0 ? void 0 : _b.length) > 0 ? dataSourcePlugin.info.links[0] : null;
    const learnMoreLinkTarget = (_c = learnMoreLink === null || learnMoreLink === void 0 ? void 0 : learnMoreLink.target) !== null && _c !== void 0 ? _c : '_blank';
    const styles = useStyles2(getStyles);
    return (React.createElement(Card, { className: cx(styles.card, 'card-parent'), onClick: isClickable ? onClick : () => { } },
        React.createElement(Card.Heading, { className: styles.heading, "aria-label": e2eSelectors.pages.AddDataSource.dataSourcePluginsV2(dataSourcePlugin.name) }, dataSourcePlugin.name),
        React.createElement(Card.Figure, { align: "center", className: styles.figure },
            React.createElement("img", { className: styles.logo, src: dataSourcePlugin.info.logos.small, alt: "" })),
        React.createElement(Card.Description, { className: styles.description }, dataSourcePlugin.info.description),
        !isPhantom && (React.createElement(Card.Meta, { className: styles.meta },
            React.createElement(PluginSignatureBadge, { status: dataSourcePlugin.signature }))),
        React.createElement(Card.Actions, { className: styles.actions }, learnMoreLink && (React.createElement(LinkButton, { "aria-label": `${dataSourcePlugin.name}, learn more.`, href: `${learnMoreLink.url}?utm_source=grafana_add_ds`, onClick: (e) => e.stopPropagation(), rel: "noopener", target: learnMoreLinkTarget, variant: "secondary" }, learnMoreLink.name)))));
}
function getStyles(theme) {
    return {
        heading: css({
            fontSize: theme.v1.typography.heading.h5,
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
            fontSize: theme.typography.size.sm,
        }),
        actions: css({
            position: 'relative',
            alignSelf: 'center',
            marginTop: '0px',
            opacity: 0,
            '.card-parent:hover &, .card-parent:focus-within &': {
                opacity: 1,
            },
        }),
        card: css({
            gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
        }),
        logo: css({
            marginRight: theme.v1.spacing.lg,
            marginLeft: theme.v1.spacing.sm,
            width: theme.spacing(7),
            maxHeight: theme.spacing(7),
        }),
    };
}
//# sourceMappingURL=DataSourceTypeCard.js.map