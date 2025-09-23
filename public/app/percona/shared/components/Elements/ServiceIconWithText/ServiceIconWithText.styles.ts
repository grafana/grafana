import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;

    & > div {
      margin-right: ${spacing(1)};
    }

    & > span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `,
});
