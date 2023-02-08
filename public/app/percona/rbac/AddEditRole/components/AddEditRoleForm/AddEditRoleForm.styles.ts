import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  pageContainer: css`
    ${theme.breakpoints.up('md')} {
      width: auto !important;
      max-width: none !important;
      margin-left: 16px !important;
      margin-right: 16px !important;
    }
  `,
  page: css`
    max-width: 350px;
  `,
  link: css`
    color: ${theme.colors.text.link};
  `,
  none: css`
    display: none;
  `,
});
