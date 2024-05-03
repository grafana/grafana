import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  buttonSpinner: css`
    margin-right: ${theme.spacing(1)};
  `,
});
