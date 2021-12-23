import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  actionsWrapper: css`
    margin-top: 60px;
  `,
  form: css`
    width: 100%;
  `,
  toogleField: css`
    margin-top: ${spacing.formInputMargin};
  `,
});
