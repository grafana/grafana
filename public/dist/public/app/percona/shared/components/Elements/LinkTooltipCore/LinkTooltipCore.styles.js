import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing, palette } }) => ({
    contentWrapper: css `
    display: flex;
    flex-direction: column;
  `,
    link: css `
    color: ${palette.gray4};
    padding-top: ${spacing.sm};
    text-decoration: underline;
    &: hover {
      color: white;
      text-decoration: underline;
    }
  `,
});
//# sourceMappingURL=LinkTooltipCore.styles.js.map