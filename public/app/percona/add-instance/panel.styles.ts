import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ breakpoints, v1: { spacing } }: GrafanaTheme2) => ({
  page: cx(
    'page-container',
    'page-body',
    css`
      ${breakpoints.up('md')} {
        width: auto !important;
        max-width: none !important;
        margin-left: 16px !important;
        margin-right: 16px !important;
      }
    `
  ),
});
