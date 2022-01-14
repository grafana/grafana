import { css } from 'emotion';

export const getStyles = () => ({
  modalWrapper: css`
    div[data-qa='modal-body'] {
      left: 25%;
      top: 6%;
      width: 50%;
      max-width: none;
    }
  `,
});
