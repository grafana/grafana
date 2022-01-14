import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  sshKeyWrapper: css`
    display: flex;
    flex-direction: column;
    width: 600px;
  `,
  textarea: css`
    margin: ${theme.spacing.md} 0;
    min-height: 150px;
  `,
}));
