export const MIN_EXTENSION_SIDEBAR_WIDTH = 460;
export const MAX_EXTENSION_SIDEBAR_WIDTH = Math.floor(window.innerWidth * (2 / 3));
export const DEFAULT_EXTENSION_SIDEBAR_WIDTH = MIN_EXTENSION_SIDEBAR_WIDTH;

export const MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH = 360;
// Past the Assistant chat's max content width, a wider floating sidebar only adds empty margins.
export const MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH = Math.min(MAX_EXTENSION_SIDEBAR_WIDTH, 768);
export const DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH = 480;
