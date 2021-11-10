import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: space-between;
    align-items: center;

    button {
      margin-left: ${spacing.md};
    }
  `,
});
