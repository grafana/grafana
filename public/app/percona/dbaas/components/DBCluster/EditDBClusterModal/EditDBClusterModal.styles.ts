import { css } from '@emotion/css';

export const getStyles = () => ({
  modalWrapper: css`
    div[data-testid='modal-body'] {
      width: 50%;
      max-width: none;
    }
  `,
});
