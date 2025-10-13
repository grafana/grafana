import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { palette } }: GrafanaTheme2) => ({
  tab: css`
    padding-left: 16px;
  `,
  advisorWrapper: css`
    display: flex;
    justify-content: space-between;
    width: 160px;
  `,
  checkIcon: css`
    color: ${palette.greenBase};
  `,
  timesIcon: css`
    color: ${palette.redBase};
  `,
});
