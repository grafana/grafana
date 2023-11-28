import { css } from '@emotion/css';
export const getStyles = ({ colors, spacing }) => ({
    warningWrapper: css `
    display: flex;
    align-items: center;
    background-color: ${colors.bg2};
    padding: ${spacing.sm};
    margin-bottom: ${spacing.xl};
  `,
    warningIcon: css `
    margin-right: ${spacing.sm};
  `,
});
//# sourceMappingURL=WarningBlock.styles.js.map