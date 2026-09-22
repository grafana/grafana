import { type GrafanaTheme2 } from '@grafana/data';

/** Spacing of the plan ground's dot grid. */
const DOT_GRID_SIZE = '11px 11px';

/**
 * Shared preview background for the controls and canvas, including empty plans.
 * Anchor the dot grid to the viewport to keep it aligned across both surfaces.
 */
export function getPlanningGround(theme: GrafanaTheme2) {
  return {
    backgroundColor: theme.colors.emphasize(theme.colors.background.canvas, 0.015),
    backgroundImage: `radial-gradient(${theme.colors.border.medium} 1px, transparent 1px)`,
    backgroundSize: DOT_GRID_SIZE,
    backgroundAttachment: 'fixed' as const,
    backgroundPosition: '0 0',
  };
}
