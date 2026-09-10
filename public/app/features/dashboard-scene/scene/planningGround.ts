import { type GrafanaTheme2 } from '@grafana/data';

/** Spacing of the plan ground's dot grid. */
const DOT_GRID_SIZE = '11px 11px';

/**
 * The ground a dashboard plan sits on: one step off the dashboard background, with a faint dot
 * grid — so the largest surface on the page says "plan" even where the per-panel signals cannot.
 * A panel the user added by hand carries no badge, and a plan below the fold or an empty one shows
 * no panels at all.
 *
 * Both surfaces anchor the grid to the viewport so the dots stay aligned across their seam,
 * regardless of the controls' height or the canvas's overlap beneath them.
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
