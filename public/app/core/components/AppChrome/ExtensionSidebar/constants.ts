export const MIN_EXTENSION_SIDEBAR_WIDTH = 360;
export const MAX_EXTENSION_SIDEBAR_WIDTH = Math.floor(window.innerWidth * (2 / 3));
export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = 460;

// Docked at the bottom: tall enough for the Assistant's prompt and a few messages, and never more than half the
// window, so the page above keeps at least the other half.
export const MIN_EXTENSION_SIDEBAR_HEIGHT = 240;
export const DEFAULT_EXTENSION_SIDEBAR_HEIGHT = 320;

/** The bottom dock's maximum height in a window `windowHeight` tall: half of it, read again as the window resizes. */
export function getMaxExtensionSidebarHeight(windowHeight: number): number {
  return Math.max(MIN_EXTENSION_SIDEBAR_HEIGHT, Math.floor(windowHeight / 2));
}

export const MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH = 360;
// Past the Assistant chat's max content width, a wider floating sidebar only adds empty margins.
export const MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH = Math.min(MAX_EXTENSION_SIDEBAR_WIDTH, 768);
export const DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH = 480;

// The floating sidebar's extension keeps its surface this far inside the window at the top and at the bottom.
const FLOATING_EXTENSION_SIDEBAR_WINDOW_GUTTER = 24;

/** The floating sidebar's maximum height in a window `windowHeight` tall, read again as the window resizes. */
export function getMaxFloatingExtensionSidebarHeight(windowHeight: number): number {
  return Math.max(0, windowHeight - 2 * FLOATING_EXTENSION_SIDEBAR_WINDOW_GUTTER);
}
