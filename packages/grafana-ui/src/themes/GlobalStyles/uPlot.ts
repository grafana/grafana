import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getUplotStyles(theme: GrafanaTheme2) {
  return css({
    '.uplot': {
      fontFamily: 'inherit',
    },

    '.u-select': {
      background: 'rgba(120, 120, 130, 0.2)',
    },

    '.u-over.zoom-drag': {
      cursor: 'zoom-in',
    },

    '.u-hz .u-cursor-x, .u-vt .u-cursor-y': {
      borderRight: '1px dashed rgba(120, 120, 130, 0.5)',
    },

    '.u-hz .u-cursor-y, .u-vt .u-cursor-x': {
      borderBottom: '1px dashed rgba(120, 120, 130, 0.5)',
    },

    '.shared-crosshair:not(.plot-active) .u-cursor-pt': {
      display: 'none !important',
    },
  });
}
