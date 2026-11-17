import { createContext, useContext } from 'react';

/**
 * True while something is docked below the page area, such as the extension sidebar at the bottom. The page area then
 * ends inside the window, so the page scrolls inside its own card and keeps the card's rounded bottom above it.
 */
export const PageAreaEndsAboveDockContext = createContext(false);

export function usePageAreaEndsAboveDock(): boolean {
  return useContext(PageAreaEndsAboveDockContext);
}
