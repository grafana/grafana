import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    headerContainer: css `
    h2 {
      margin: ${spacing.xl} ${spacing.lg} ${spacing.xs} ${spacing.lg};
    }

    hr {
      margin: ${spacing.xs} ${spacing.md};
    }
  `,
});
//# sourceMappingURL=PageHeader.styles.js.map