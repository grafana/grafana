import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    loader: css `
    display: flex;
    justify-content: center;
  `,
    collapseWrapper: css `
    margin-bottom: ${spacing.md};
    margin-top: ${spacing.md};
  `,
    noDataLabel: css `
    display: flex;
    justify-content: center;
  `,
});
//# sourceMappingURL=Entitlements.styles.js.map