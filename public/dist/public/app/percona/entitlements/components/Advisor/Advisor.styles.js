import { css } from '@emotion/css';
export const getStyles = ({ v1: { palette } }) => ({
    tab: css `
    padding-left: 16px;
  `,
    advisorWrapper: css `
    display: flex;
    justify-content: space-between;
    width: 160px;
  `,
    checkIcon: css `
    color: ${palette.greenBase};
  `,
    timesIcon: css `
    color: ${palette.redBase};
  `,
});
//# sourceMappingURL=Advisor.styles.js.map