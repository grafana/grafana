import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  statusLine: css`
    display: flex;
    align-items: center;

    & > div:first-child {
      margin-right: ${spacing(1)};
    }

    &:not(:last-child) {
      margin-bottom: ${spacing(2)};
    }
  `,
});
