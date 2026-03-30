import { createContext } from 'react';

import { type VizPanel } from '@grafana/scenes';

export interface PopoverTarget {
  panel: VizPanel;
  anchorEl: HTMLElement;
}

/**
 * Context that lets the sparkle hint button trigger the popover
 * without going through the element selection system.
 *
 * Supports multi-panel selection: once the popover is open, clicking
 * another sparkle adds that panel to the context. Clicking the same
 * sparkle again removes it (toggle).
 */
export const AssistantPopoverContext = createContext<{
  openPopover: (panel: VizPanel, anchorEl: HTMLElement, multi: boolean) => void;
} | null>(null);
