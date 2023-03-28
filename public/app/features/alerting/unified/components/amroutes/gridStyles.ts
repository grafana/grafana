import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getGridStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: grid;
      font-style: ${theme.typography.fontSize};
      grid-template-columns: ${theme.spacing(15.5)} auto;

      ${theme.breakpoints.down('md')} {
        grid-template-columns: 100%;
      }
    `,
    titleCell: css`
      color: ${theme.colors.text.primary};
    `,
    valueCell: css`
      color: ${theme.colors.text.secondary};
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
