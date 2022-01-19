import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  deleteWarning: css`
    margin-top: ${spacing.lg};
  `,
});
