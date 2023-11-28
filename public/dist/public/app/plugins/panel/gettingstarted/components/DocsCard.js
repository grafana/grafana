import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';
export const DocsCard = ({ card }) => {
    const styles = useStyles2(getStyles, card.done);
    const iconStyles = useStyles2(iconStyle, card.done);
    return (React.createElement("div", { className: styles.card },
        React.createElement("div", { className: cardContent },
            React.createElement("a", { href: `${card.href}?utm_source=grafana_gettingstarted`, className: styles.url },
                React.createElement("div", { className: styles.heading }, card.done ? 'complete' : card.heading),
                React.createElement("h4", { className: styles.title }, card.title),
                React.createElement("div", null,
                    React.createElement(Icon, { className: iconStyles, name: card.icon, size: "xxl" })))),
        React.createElement("a", { href: `${card.learnHref}?utm_source=grafana_gettingstarted`, className: styles.learnUrl, target: "_blank", rel: "noreferrer" },
            "Learn how in the docs ",
            React.createElement(Icon, { name: "external-link-alt" }))));
};
const getStyles = (theme, complete) => {
    return {
        card: css `
      ${cardStyle(theme, complete)}

      min-width: 230px;

      ${theme.breakpoints.down('md')} {
        min-width: 192px;
      }
    `,
        heading: css `
      text-transform: uppercase;
      color: ${complete ? theme.v1.palette.blue95 : '#FFB357'};
      margin-bottom: ${theme.spacing(2)};
    `,
        title: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        url: css `
      display: inline-block;
    `,
        learnUrl: css `
      border-top: 1px solid ${theme.colors.border.weak};
      position: absolute;
      bottom: 0;
      padding: 8px 16px;
      width: 100%;
    `,
    };
};
//# sourceMappingURL=DocsCard.js.map