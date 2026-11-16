/**
 * Stable class name on a cell control, which a hover rule on the cell frame selects. Emotion
 * generates its class names, so a parent that reveals the style of a child needs a hand-written
 * class and a descendant selector. The dashboard layouts do the same with `dashboard-canvas-controls`.
 */
export const NOTEBOOK_CELL_CONTROLS_CLASS = 'notebook-cell-controls';

/** Stable class name on the frame itself, so the cell list can see which cell the pointer is over. */
export const NOTEBOOK_CELL_FRAME_CLASS = 'notebook-cell-frame';

/**
 * A control that must stay visible while the pointer is on another cell. A control with an open menu
 * needs this, because the menu renders in a portal and the control is then not `:focus-within`.
 */
export const NOTEBOOK_CELL_CONTROLS_PINNED_CLASS = 'notebook-cell-controls-pinned';
