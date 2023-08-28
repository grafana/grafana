import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ breakpoints, v1: { spacing } }: GrafanaTheme2) => ({
  content: css`
    display: flex;
    flex-direction: column;
    align-content: center;
    align-items: center;
    width: 100%;
  `,
  returnButton: css`
    align-self: flex-start;
    margin-bottom: ${spacing.md};
  `,
  page: css`
    ${breakpoints.up('md')} {
      width: auto !important;
      max-width: none !important;
      margin-left: 16px !important;
      margin-right: 16px !important;
    }
  `,
});
