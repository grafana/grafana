import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getAccessibilityStyles(theme: GrafanaTheme2) {
  return css({
    '.sr-only': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      border: 0,
    },
  });
}
