import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    statusLine: css `
    display: flex;
    align-items: center;

    & > div:first-child {
      margin-right: ${spacing(1)};
    }

    &:not(:last-child) {
      margin-bottom: ${spacing(2)};
    }
  `,
});
//# sourceMappingURL=StatusInfo.styles.js.map