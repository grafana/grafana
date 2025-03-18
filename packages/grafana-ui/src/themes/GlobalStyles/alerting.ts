import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getAlertingStyles(theme: GrafanaTheme2) {
  return css({
    '.alert-state-paused, .alert-state-pending': {
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    },

    '.alert-state-ok': {
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
    },

    '.alert-state-warning': {
      color: theme.colors.warning.text,
      fontWeight: theme.typography.fontWeightMedium,
    },

    '.alert-state-critical': {
      color: theme.colors.error.text,
      fontWeight: theme.typography.fontWeightMedium,
    },
  });
}
