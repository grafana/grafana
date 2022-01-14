import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const mq = `@media (max-width: ${theme.breakpoints.md})`;

  return {
    instanceForm: css`
      padding: 0px;
      margin-bottom: ${theme.spacing.sm};
      width: 100%;
    `,
    buttonsWrapper: css`
      display: flex;
      width: 100%;
    `,
    fieldsWrapper: css`
      display: flex;
      width: 100%;
      div {
        width: 100%;
      }
      div:first-child {
        margin-right: ${theme.spacing.md};
      }
      ${mq} {
        flex-direction: column;
        div:first-child {
          margin-right: unset;
        }
      }
    `,
    credentialsField: css`
      width: 48%;
    `,
    credentialsSubmit: css`
      margin-top: 2px;
      margin-left: ${theme.spacing.md};
      margin-right: ${theme.spacing.sm};
    `,
  };
});
