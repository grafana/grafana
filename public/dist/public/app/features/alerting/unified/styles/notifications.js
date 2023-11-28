import { css } from '@emotion/css';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
export const getNotificationsTextColors = (theme) => ({
    [AlertState.Active]: css `
    color: ${theme.colors.error.text};
  `,
    [AlertState.Suppressed]: css `
    color: ${theme.colors.primary.text};
  `,
    [AlertState.Unprocessed]: css `
    color: ${theme.colors.secondary.text};
  `,
});
//# sourceMappingURL=notifications.js.map