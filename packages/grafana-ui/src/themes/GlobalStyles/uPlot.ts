import { css } from '@emotion/react';

import { type GrafanaTheme2 } from '@grafana/data';

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

    // Plots that turn off cursor.points.one (time comparison) get a hover point per series from uPlot,
    // but should only show the hovered series and its comparison counterpart. preparePlotConfigBuilder
    // marks that pair on hover; everything else stays hidden.
    '.u-cursor-pts-paired .u-cursor-pt:not(.u-cursor-pt-visible)': {
      display: 'none',
    },
  });
}
