import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Drawer, ToolbarButton, useStyles2, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';
import { NewsWrapper } from './NewsWrapper';
export function NewsContainer({ className }) {
    const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(ToolbarButton, { className: className, onClick: onToggleShowNewsDrawer, iconOnly: true, icon: "rss", "aria-label": "News" }),
        showNewsDrawer && (React.createElement(Drawer, { title: React.createElement("div", { className: styles.title },
                React.createElement(Text, { element: "h3" }, t('news.title', 'Latest from the blog')),
                React.createElement("a", { href: "https://grafana.com/blog/", target: "_blank", rel: "noreferrer", title: "Go to Grafana labs blog", className: styles.grot },
                    React.createElement("img", { src: "public/img/grot-news.svg", alt: "Grot reading news" })),
                React.createElement("div", { className: styles.actions },
                    React.createElement(Button, { icon: "times", variant: "secondary", fill: "text", onClick: onToggleShowNewsDrawer, "aria-label": selectors.components.Drawer.General.close }))), onClose: onToggleShowNewsDrawer, size: "md" },
            React.createElement(NewsWrapper, { feedUrl: DEFAULT_FEED_URL })))));
}
const getStyles = (theme) => {
    return {
        title: css({
            display: `flex`,
            alignItems: `center`,
            justifyContent: `center`,
            gap: theme.spacing(2),
            borderBottom: `1px solid ${theme.colors.border.weak}`,
        }),
        grot: css({
            display: `flex`,
            alignItems: `center`,
            justifyContent: `center`,
            padding: theme.spacing(2, 0),
            img: {
                width: `75px`,
                height: `75px`,
            },
        }),
        actions: css({
            position: 'absolute',
            right: theme.spacing(1),
            top: theme.spacing(2),
        }),
    };
};
//# sourceMappingURL=NewsContainer.js.map