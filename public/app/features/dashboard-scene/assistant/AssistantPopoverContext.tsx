import { createContext } from 'react';

import { VizPanel } from '@grafana/scenes';

export interface PopoverTarget {
  panel: VizPanel;
  anchorEl: HTMLElement;
}

/**
 * Context that lets the sparkle hint button trigger the popover
 * without going through the element selection system.
 */
export const AssistantPopoverContext = createContext<{
  openPopover: (panel: VizPanel, anchorEl: HTMLElement) => void;
} | null>(null);
