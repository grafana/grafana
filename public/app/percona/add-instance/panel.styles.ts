import { css } from 'emotion';

export const getStyles = () => ({
  content: css`
    display: flex;
    flex-direction: column;
    align-content: center;
    align-items: center;
    width: 100%;
  `,
  returnButton: css`
    position: absolute;
    left: 50px;
  `,
});
