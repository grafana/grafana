import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ palette }: GrafanaTheme) => ({
  ellipsisContainer: css`
    display: table;
    width: 20px;
    margin: 0 auto;
  `,
  statusSuccess: css`
    color: ${palette.greenBase};
  `,
  statusError: css`
    color: ${palette.redBase};
  `,
});
