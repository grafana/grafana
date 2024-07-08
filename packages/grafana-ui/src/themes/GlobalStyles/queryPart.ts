import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getQueryPartStyles(theme: GrafanaTheme2) {
  return css({
    '.query-part': {
      backgroundColor: theme.colors.background.secondary,

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    },
  });
}
