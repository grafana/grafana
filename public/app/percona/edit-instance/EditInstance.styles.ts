import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  link: css`
    color: ${theme.colors.text.link};
  `,
  hidden: css`
    display: none;
  `,
});
