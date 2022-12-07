import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  pageToolbarWrapper: css`
    display: flex;
    align-items: flex-start;
    padding-right: ${spacing.lg};
  `,
  pageContent: css`
    padding: 0 ${spacing.lg};
  `,
});
