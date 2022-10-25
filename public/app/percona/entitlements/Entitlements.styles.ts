import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  loader: css`
    display: flex;
    justify-content: center;
  `,
  collapseWrapper: css`
    margin-bottom: ${spacing.md};
    margin-top: ${spacing.md};
  `,
  noDataLabel: css`
    display: flex;
    justify-content: center;
  `,
});
