import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    margin-left: ${theme.spacing(1)};
  `,
});
