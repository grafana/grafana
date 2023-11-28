import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    connectionItemWrapper: css `
    display: flex;
    margin-bottom: ${spacing.xxs};
  `,
    connectionItemLabel: css `
    font-weight: ${typography.weight.bold};
  `,
    connectionItemValue: css `
    margin-left: ${spacing.xs};
  `,
});
//# sourceMappingURL=DBClusterConnectionItem.styles.js.map