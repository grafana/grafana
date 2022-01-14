import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  instanceForm: css`
    padding: 0px;
    margin-bottom: ${theme.spacing.sm};
    width: 800px;
  `,
  searchPanel: css`
    display: flex;
    justify-content: space-between;
    width: 100%;
  `,
  credentialsField: css`
    width: 42%;
  `,
  credentialsSubmit: css`
    margin-top: 2px;
  `,
}));
