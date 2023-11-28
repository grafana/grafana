import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    pageSwitcherWrapper: css `
    display: flex;
    padding: ${spacing.lg} 0px ${spacing.lg} 0px;
    margin-bottom: ${spacing.lg};
    gap: 10px;
  `,
    wrapper: css `
    width: 380px;
    cursor: pointer;
    user-select: none;
  `,
    disabled: css `
    opacity: 0.5;
  `,
});
//# sourceMappingURL=PageSwitcherCard.styles.js.map