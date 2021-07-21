import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

export const getNotificationsTextColors = (theme: GrafanaTheme2) => ({
  [AlertState.Active]: css`
    color: ${theme.colors.error.main};
  `,
  [AlertState.Suppressed]: css`
    color: ${theme.colors.primary.main};
  `,
  [AlertState.Unprocessed]: css`
    color: ${theme.colors.secondary.main};
  `,
});
