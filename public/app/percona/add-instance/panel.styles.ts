import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';

export const getStyles = stylesFactory(() => ({
  content: css`
    display: flex;
    flex-direction: column;
    align-content: center;
    align-items: center;
  `,
  contentPadding: css`
    padding-top: 20px;
  `,
  returnButton: css`
    position: absolute;
    left: 50px;
  `,
}));
