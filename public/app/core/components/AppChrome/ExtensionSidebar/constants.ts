export const MIN_EXTENSION_SIDEBAR_WIDTH = 360;
export const MAX_EXTENSION_SIDEBAR_WIDTH = Math.floor(window.innerWidth * (2 / 3));
export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = 460;

// Docked at the bottom: tall enough for the Assistant's prompt and a few messages, and never more than half the
// window, so the page above keeps at least the other half.
export const MIN_EXTENSION_SIDEBAR_HEIGHT = 240;
export const MAX_EXTENSION_SIDEBAR_HEIGHT = Math.max(MIN_EXTENSION_SIDEBAR_HEIGHT, Math.floor(window.innerHeight / 2));
export const DEFAULT_EXTENSION_SIDEBAR_HEIGHT = 320;

export const MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH = 360;
// Past the Assistant chat's max content width, a wider floating sidebar only adds empty margins.
export const MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH = Math.min(MAX_EXTENSION_SIDEBAR_WIDTH, 768);
export const DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH = 480;
