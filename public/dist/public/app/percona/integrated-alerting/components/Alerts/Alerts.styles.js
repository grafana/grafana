import { css } from '@emotion/css';
export const getStyles = ({ colors }) => {
    return {
        disabledRow: css `
      background-color: ${colors.action.disabledBackground} !important;
      opacity: ${colors.action.disabledOpacity};
    `,
        silencedSeverity: css `
      color: inherit;
    `,
        ruleLink: css `
      color: ${colors.text.link};
    `,
        disableActionCell: css `
      opacity: 1;
      background-color: rgba(204, 204, 220, 0.0152) !important;
    `,
    };
};
//# sourceMappingURL=Alerts.styles.js.map