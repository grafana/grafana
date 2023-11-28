import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    pageSwitcherWrapper: css `
    display: flex;
    padding: ${spacing.lg} 0px ${spacing.lg} 0px;
    & > label {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 50px;
      min-width: 200px;
      white-space: pre-line;
      line-height: inherit;
    }
  `,
});
//# sourceMappingURL=PageSwitcher.styles.js.map