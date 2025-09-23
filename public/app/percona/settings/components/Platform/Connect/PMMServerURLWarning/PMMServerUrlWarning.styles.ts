import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  alert: css`
    p {
      margin-bottom: 0;
    }
    margin: ${spacing.md} 0;
  `,
});
