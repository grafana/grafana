import { css, cx } from '@emotion/css';
import React from 'react';
import { Components } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Icon, useStyles2 } from '@grafana/ui';
export function BreadcrumbItem({ href, isCurrent, text, index, flexGrow }) {
    const styles = useStyles2(getStyles);
    const onBreadcrumbClick = () => {
        reportInteraction('grafana_breadcrumb_clicked', { url: href });
    };
    return (React.createElement("li", { className: styles.breadcrumbWrapper, style: { flexGrow } }, isCurrent ? (React.createElement("span", { "data-testid": Components.Breadcrumbs.breadcrumb(text), className: styles.breadcrumb, "aria-current": "page", title: text }, text)) : (React.createElement(React.Fragment, null,
        React.createElement("a", { onClick: onBreadcrumbClick, "data-testid": Components.Breadcrumbs.breadcrumb(text), className: cx(styles.breadcrumb, styles.breadcrumbLink), title: text, href: href }, text),
        React.createElement("div", { className: styles.separator, "aria-hidden": true },
            React.createElement(Icon, { name: "angle-right" }))))));
}
const getStyles = (theme) => {
    return {
        breadcrumb: css({
            display: 'block',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            padding: theme.spacing(0, 0.5),
            whiteSpace: 'nowrap',
            color: theme.colors.text.secondary,
        }),
        breadcrumbLink: css({
            color: theme.colors.text.primary,
            '&:hover': {
                textDecoration: 'underline',
            },
        }),
        breadcrumbWrapper: css({
            alignItems: 'center',
            color: theme.colors.text.primary,
            display: 'flex',
            flex: 1,
            minWidth: 0,
            maxWidth: 'max-content',
            // logic for small screens
            // hide any breadcrumbs that aren't the second to last child (the parent)
            // unless there's only one breadcrumb, in which case we show it
            [theme.breakpoints.down('sm')]: {
                display: 'none',
                '&:nth-last-child(2)': {
                    display: 'flex',
                    minWidth: '40px',
                },
                '&:last-child': {
                    display: 'flex',
                },
            },
        }),
        separator: css({
            color: theme.colors.text.secondary,
        }),
    };
};
//# sourceMappingURL=BreadcrumbItem.js.map