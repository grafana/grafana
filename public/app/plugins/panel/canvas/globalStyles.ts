import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getGlobalStyles(theme: GrafanaTheme2) {
  return css`
    .moveable-control-box {
      z-index: 999;
    }
  `;
}
