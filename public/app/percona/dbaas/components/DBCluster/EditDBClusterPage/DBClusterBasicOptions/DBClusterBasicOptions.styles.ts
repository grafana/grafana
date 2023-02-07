import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  line: css`
    display: flex;
    gap: ${spacing.lg};
    > div {
      flex: 1 0;
    }
  `,
  basicOptions: css`
    margin-bottom: 25px;
  `,
});
