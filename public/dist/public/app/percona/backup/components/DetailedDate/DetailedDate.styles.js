import { css } from '@emotion/css';
export const getStyles = ({ typography, colors, spacing }) => ({
    hourWrapper: css `
    font-size: ${typography.size.sm};
    color: ${colors.textSemiWeak};
    margin-left: ${spacing.xxs};
  `,
    timeWrapper: css `
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
});
//# sourceMappingURL=DetailedDate.styles.js.map