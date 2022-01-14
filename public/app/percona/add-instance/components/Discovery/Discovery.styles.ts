import { css } from 'emotion';

import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory(() => ({
  content: css`
    display: flex;
    flex-direction: column;
    align-items: center;
  `,
}));
