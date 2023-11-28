import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    alertManagerWrapper: css `
    display: flex;
    flex-direction: column;
  `,
    textarea: css `
    margin: ${spacing.md} 0;
    min-height: 150px;
  `,
    input: css `
    margin: ${spacing.md} 0;
  `,
    rulesLabel: css `
    margin-top: ${spacing.sm};
  `,
    warning: css `
    margin-bottom: ${spacing.md};
  `,
    warningLink: css `
    text-decoration: underline;
  `,
});
//# sourceMappingURL=AlertManager.styles.js.map