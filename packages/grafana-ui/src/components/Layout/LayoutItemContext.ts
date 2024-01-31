import { createContext } from 'react';

export interface LayoutItemContextProps {
  boostZIndex(): () => void;
}

/**
 * Provides an API for downstream components (e.g. within panels) to inform the layout
 * that anchored tooltips or context menus could overflow the panel bounds. The layout
 * system can then boost the z-index of items with any anchored contents to prevent the overflown
 * content from rendering underneath adjacent layout items (e.g. other panels) that naturally
 * render later/higher in the stacking order
 *
 * This is used by VizTooltips and Annotations, which anchor to data points or time range within
 * the viz drawing area
 *
 * @internal
 */
export const LayoutItemContext = createContext<LayoutItemContextProps>({
  boostZIndex: () => () => {},
});
