import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  deleteWarning: css`
    margin-top: ${spacing.lg};
  `,
});
