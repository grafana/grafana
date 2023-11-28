import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    connectionItemWrapper: css `
    display: flex;
    align-items: center;
    margin-bottom: ${spacing.xxs};
  `,
    connectionItemLabel: css `
    font-weight: ${typography.weight.bold};
  `,
    connectionItemValue: css `
    margin-left: ${spacing.sm};
  `,
});
//# sourceMappingURL=OperatorStatusItem.styles.js.map