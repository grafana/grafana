import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getExtraStyles(theme: GrafanaTheme2) {
  return css`
    // fix white background on intercom in dark mode
    iframe.intercom-borderless-frame {
      color-scheme: ${theme.colors.mode};
    }
  `;
}
