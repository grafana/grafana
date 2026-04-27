import { css } from '@emotion/react';

import type { GrafanaTheme2 } from '@grafana/data/themes';

export function getExtraStyles(theme: GrafanaTheme2) {
  return css({
    // fix white background on intercom in dark mode
    'iframe.intercom-borderless-frame': {
      colorScheme: theme.colors.mode,
    },
  });
}
