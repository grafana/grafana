import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { DocsCard } from './DocsCard';
import { TutorialCard } from './TutorialCard';
export const Step = ({ step }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.setup },
        React.createElement("div", { className: styles.info },
            React.createElement("h2", { className: styles.title }, step.title),
            React.createElement("p", null, step.info)),
        React.createElement("div", { className: styles.cards }, step.cards.map((card, index) => {
            const key = `${card.title}-${index}`;
            if (card.type === 'tutorial') {
                return React.createElement(TutorialCard, { key: key, card: card });
            }
            return React.createElement(DocsCard, { key: key, card: card });
        }))));
};
const getStyles = (theme) => {
    return {
        setup: css `
      display: flex;
      width: 95%;
    `,
        info: css `
      width: 172px;
      margin-right: 5%;

      ${theme.breakpoints.down('xxl')} {
        margin-right: ${theme.spacing(4)};
      }
      ${theme.breakpoints.down('sm')} {
        display: none;
      }
    `,
        title: css `
      color: ${theme.v1.palette.blue95};
    `,
        cards: css `
      overflow-x: scroll;
      overflow-y: hidden;
      width: 100%;
      display: flex;
      justify-content: center;

      ${theme.breakpoints.down('xxl')} {
        justify-content: flex-start;
      }
    `,
    };
};
//# sourceMappingURL=Step.js.map