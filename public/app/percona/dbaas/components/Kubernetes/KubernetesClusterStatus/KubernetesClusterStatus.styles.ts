import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1 }: GrafanaTheme2) => ({
  clusterStatusWrapper: css`
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${v1.spacing.xs} 0;

    a > span {
      cursor: pointer;
    }
  `,
});
