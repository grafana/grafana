import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  backupWrapper: css`
    margin: ${spacing.lg};
  `,
});
