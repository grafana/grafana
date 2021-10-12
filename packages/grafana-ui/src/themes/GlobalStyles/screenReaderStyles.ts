import { css } from '@emotion/css';

export function getScreenReaderOnlyStyles() {
  return css`
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
}
