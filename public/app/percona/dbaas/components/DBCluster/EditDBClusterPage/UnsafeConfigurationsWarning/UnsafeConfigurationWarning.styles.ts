import { css } from '@emotion/css';

export const getStyles = () => ({
  alertMessageWrapper: css`
    & > div:last-child {
      > div:last-child {
        padding: 0;
      }
    }
  `,
});
