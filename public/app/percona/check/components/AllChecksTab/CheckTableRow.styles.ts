import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => ({
  actionsWrapper: css`
    align-items: center;
    justify-content: center;
    display: flex;

    > :not(:last-child) {
      margin-right: 10px;
    }
  `,
});
