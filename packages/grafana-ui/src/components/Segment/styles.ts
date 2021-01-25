import { css } from 'emotion';
import { stylesFactory } from '../../themes';

export const getStyles = stylesFactory(() => {
  return {
    disabled: css`
      cursor: not-allowed;
      opacity: 0.65;
      box-shadow: none;
    `,
  };
});
