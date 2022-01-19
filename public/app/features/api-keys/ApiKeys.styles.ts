import { css } from 'emotion';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  deleteWarning: css`
    margin-top: ${spacing.lg};
  `,
});
