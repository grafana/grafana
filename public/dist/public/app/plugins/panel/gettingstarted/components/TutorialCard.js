import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';
import { cardContent, cardStyle, iconStyle } from './sharedStyles';
export const TutorialCard = ({ card }) => {
    const styles = useStyles2(getStyles, card.done);
    const iconStyles = useStyles2(iconStyle, card.done);
    return (React.createElement("a", { className: styles.card, target: "_blank", rel: "noreferrer", href: `${card.href}?utm_source=grafana_gettingstarted`, onClick: (event) => handleTutorialClick(event, card) },
        React.createElement("div", { className: cardContent },
            React.createElement("div", { className: styles.type }, card.type),
            React.createElement("div", { className: styles.heading }, card.done ? 'complete' : card.heading),
            React.createElement("h4", { className: styles.cardTitle }, card.title),
            React.createElement("div", { className: styles.info }, card.info),
            React.createElement(Icon, { className: iconStyles, name: card.icon, size: "xxl" }))));
};
const handleTutorialClick = (event, card) => {
    event.preventDefault();
    const isSet = store.get(card.key);
    if (!isSet) {
        store.set(card.key, true);
    }
};
const getStyles = (theme, complete) => {
    return {
        card: css `
      ${cardStyle(theme, complete)}
      width: 460px;
      min-width: 460px;

      ${theme.breakpoints.down('xl')} {
        min-width: 368px;
      }

      ${theme.breakpoints.down('lg')} {
        min-width: 272px;
      }
    `,
        type: css `
      color: ${theme.colors.primary.text};
      text-transform: uppercase;
    `,
        heading: css `
      text-transform: uppercase;
      color: ${theme.colors.primary.text};
      margin-bottom: ${theme.spacing(1)};
    `,
        cardTitle: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        info: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        status: css `
      display: flex;
      justify-content: flex-end;
    `,
    };
};
//# sourceMappingURL=TutorialCard.js.map