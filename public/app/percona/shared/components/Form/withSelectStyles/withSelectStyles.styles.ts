import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  select: css`
    margin-bottom: ${spacing.xl};
    & > div {
      padding: 7px 8px;
    }
  `,
});
