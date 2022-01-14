import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

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
