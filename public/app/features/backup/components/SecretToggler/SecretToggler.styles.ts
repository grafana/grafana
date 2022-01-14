import { css } from 'emotion';

export const getStyles = () => ({
  fieldWrapper: css`
    position: relative;
  `,
  input: css`
    padding: 0;
    border: none;
    &[readonly] {
      background-color: transparent;
    }
  `,
  lock: css`
    cursor: pointer;
  `,
  fullLock: css`
    position: absolute;
    right: 7px;
    top: 30px;
  `,
});
