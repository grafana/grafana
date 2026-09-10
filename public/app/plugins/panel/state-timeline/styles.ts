import { css } from '@emotion/css';

export const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',
});

export function getFixedHeightContainerStyles(height: number, overflowY: 'auto' | 'hidden') {
  return css({
    height,
    overflowX: 'hidden',
    overflowY,
  });
}
