import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    infoIcon: css `
    margin-left: ${spacing.xs};
    margin-right: ${spacing.sm};
  `,
    currentVersion: css `
    p {
      font-size: ${typography.size.md};
      line-height: ${typography.lineHeight.sm};
      margin-bottom: ${spacing.xxs};
    }
  `,
    releaseDate: css `
    font-size: ${typography.size.sm};
  `,
});
//# sourceMappingURL=CurrentVersion.styles.js.map