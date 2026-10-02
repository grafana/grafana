import { css } from '@emotion/react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';

/**
 * Crosshair colour, one step below the axis label colour (`text.primary`) and well clear of the
 * gridlines it crosses. Exported so the contrast test has a single source of truth.
 *
 * @internal
 */
export function getCrosshairColor(theme: GrafanaTheme2) {
  return theme.colors.text.secondary;
}

export function getUplotStyles(theme: GrafanaTheme2) {
  const crosshairColor = getCrosshairColor(theme);

  return css({
    '.uplot': {
      fontFamily: 'inherit',
    },

    '.u-select': {
      background: colorManipulator.alpha(theme.colors.text.primary, 0.2),
      // A fill opaque enough to reach 3:1 would hide the data being selected, so the boundary
      // carries the contrast instead. `inset` keeps it out of layout, which uPlot sets inline.
      boxShadow: `inset 0 0 0 1px ${crosshairColor}`,
    },

    '.u-over.zoom-drag': {
      cursor: 'zoom-in',
    },

    '.u-hz .u-cursor-x, .u-vt .u-cursor-y': {
      borderRight: `1px dashed ${crosshairColor}`,
    },

    '.u-hz .u-cursor-y, .u-vt .u-cursor-x': {
      borderBottom: `1px dashed ${crosshairColor}`,
    },

    '.shared-crosshair:not(.plot-active) .u-cursor-pt': {
      display: 'none !important',
    },
  });
}
