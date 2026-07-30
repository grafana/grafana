import { type RefObject, useLayoutEffect } from 'react';

import { SIDEBAR_CARD_DATA_ATTR } from '../../constants';

/**
 * Keeps the selected sidebar card visible. Selection can change from outside the sidebar — most
 * notably scrolling the stacked content area, which drives the active card — leaving the card
 * outside the sidebar's scroll viewport. This re-reveals it. `block: 'nearest'` makes it a no-op
 * when the card is already in view, so a direct sidebar click never causes a jump.
 *
 * Runs in a layout effect so the scroll is applied before paint, in the same frame as the selection
 * highlight — otherwise the card would flash briefly out of view.
 */
export function useScrollSelectedCardIntoView(containerRef: RefObject<HTMLElement>, selectedId: string | null): void {
  useLayoutEffect(() => {
    if (!selectedId) {
      return;
    }

    const card = containerRef.current?.querySelector(`[${SIDEBAR_CARD_DATA_ATTR}="${CSS.escape(selectedId)}"]`);
    card?.scrollIntoView({ block: 'nearest' });
  }, [containerRef, selectedId]);
}
