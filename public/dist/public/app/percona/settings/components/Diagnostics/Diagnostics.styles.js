import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    diagnosticsWrapper: css `
    flex: 1;
  `,
    diagnosticsLabel: css `
    display: flex;
    i {
      margin-left: ${spacing.xs};
    }
  `,
    diagnosticsButton: css `
    margin-top: ${spacing.md};
    svg {
      margin-right: ${spacing.sm};
    }
  `,
});
//# sourceMappingURL=Diagnostics.styles.js.map