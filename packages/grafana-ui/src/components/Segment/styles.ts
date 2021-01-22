import { css } from 'emotion';
import { stylesFactory } from '../../themes';
import { SegmentProps } from './types';

export const getStyles = stylesFactory(<T>(props: Pick<SegmentProps<T>, 'disabled'>) => {
  return {
    link: props.disabled
      ? css`
          cursor: not-allowed;
          opacity: 0.65;
          box-shadow: none;
        `
      : '',
  };
});
