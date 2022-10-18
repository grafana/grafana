import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette }: GrafanaTheme) => ({
  statusContainer: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
  ellipsisContainer: css`
    display: table;
    width: 15px;
  `,
  statusSuccess: css`
    color: ${palette.greenBase};
  `,
  statusError: css`
    color: ${palette.redBase};
  `,
  logs: css`
    color: ${palette.blue77};
    text-decoration: underline;
    cursor: pointer;
  `,
});
