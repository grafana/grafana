import { createContext, useContext } from 'react';

/**
 * True while a page canvas's tab strip sits on top of the page. With the visual refresh the strip draws the card's
 * rounded top, so the page's own card continues it instead of drawing a second top.
 */
export const PageCanvasJoinContext = createContext(false);

export function usePageCanvasJoined(): boolean {
  return useContext(PageCanvasJoinContext);
}
