import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    label: css `
    font-size: ${typography.size.lg};
    margin-bottom: ${spacing.md};
  `,
    labelSpacing: css `
    margin-top: ${spacing.sm};
  `,
});
//# sourceMappingURL=PodLogs.styles.js.map