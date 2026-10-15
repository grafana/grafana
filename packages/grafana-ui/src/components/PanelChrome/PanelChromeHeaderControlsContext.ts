import { createContext, useContext } from 'react';

/**
 * Lets a consumer outside the panel take over the panel header controls.
 *
 * @internal
 */
export interface PanelChromeHeaderControls {
  /** When true, PanelChrome does not render its own menu button or hover widget. */
  external: boolean;
  /**
   * Element that receives the hover widget contents (drag handle, description, title items, actions)
   * of panels with a hover header. Nothing is rendered while it is null.
   */
  hoverSlot: HTMLElement | null;
  /** Leaves the drag handle out of the hover widget contents, e.g. while the panel is not in a grid. */
  hideDragHandle?: boolean;
}

/**
 * @internal
 */
export const PanelChromeHeaderControlsContext = createContext<PanelChromeHeaderControls | undefined>(undefined);

export function usePanelChromeHeaderControls() {
  return useContext(PanelChromeHeaderControlsContext);
}

/**
 * True while header items render in the external hover slot, where they sit next to icon buttons
 * and drop their own padding and secondary color to match them.
 */
export const HoverSlotItemsContext = createContext(false);
