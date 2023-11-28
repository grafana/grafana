import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    wrapper: css `
    display: flex;
    align-items: center;

    & > div {
      margin-right: ${spacing(1)};
    }

    & > span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `,
});
//# sourceMappingURL=ServiceIconWithText.styles.js.map