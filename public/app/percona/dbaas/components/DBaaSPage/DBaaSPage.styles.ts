import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, breakpoints }: GrafanaTheme) => ({
  pageToolbarWrapper: css`
    display: flex;
    align-items: flex-start;
    padding-right: ${spacing.lg};
  `,
  pageContent: css`
    padding: 0 ${spacing.lg};
    width: ${breakpoints.xxl};
  `,

  scrollWrapper: css`
    width: 100%;
    display: flex;
    overflow: scroll;
    height: 85vh;
  `,
});
