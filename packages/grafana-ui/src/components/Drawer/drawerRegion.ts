/**
 * Hooks that let Grafana's chrome tell `Drawer` which part of the screen it may cover.
 * By default a drawer covers the whole `.main-view`. Chrome that shows something next to the page
 * (a docked extension sidebar, the fullscreen workspace) uses these to keep that surface usable.
 */

/** Marks the element drawers mount into instead of `.main-view`, e.g. the fullscreen workspace Platform tab. */
export const DRAWER_CONTAINER_ATTRIBUTE = 'data-drawer-container';

/**
 * Marks surfaces outside the drawer region that stay interactive while a drawer is open.
 * The drawer's focus manager treats them as inside, so it doesn't hide them from assistive technology.
 */
export const DRAWER_COMPANION_ATTRIBUTE = 'data-drawer-companion';

/** CSS variable with the width reserved on the right of the drawer region, e.g. for a docked extension sidebar. */
export const DRAWER_OFFSET_RIGHT_VAR = '--drawer-offset-right';

export const DRAWER_CONTAINER_SELECTOR = `[${DRAWER_CONTAINER_ATTRIBUTE}], .main-view`;
