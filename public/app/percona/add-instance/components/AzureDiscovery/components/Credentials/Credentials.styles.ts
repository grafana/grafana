import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  instanceForm: css`
    padding: 0px;
    margin-bottom: ${theme.spacing.sm};
  `,
  searchPanel: css`
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: baseline;
  `,
  credentialsField: css`
    width: 48%;
  `,
  credentialsSubmit: css`
    margin-top: 2px;
    margin-left: ${theme.spacing.md};
    margin-right: ${theme.spacing.sm};
  `,
}));
