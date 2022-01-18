import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  contentWrapper: css`
    display: flex;
    flex-direction: column;
  `,
  link: css`
    color: #d8d9da;
    padding-top: ${theme.spacing.sm};
    text-decoration: underline;
    &: hover {
      color: white;
      text-decoration: underline;
    }
  `,
}));
