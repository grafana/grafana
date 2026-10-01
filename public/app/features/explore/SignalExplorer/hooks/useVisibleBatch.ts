import { useCallback, useState } from 'react';

/** How many rows of a long list reach the DOM at a time, and how many each "show more" adds. */
const INITIAL_BATCH = 25;

/**
 * Caps how much of a long list is rendered. Hiding the overflow with CSS is not enough — a
 * Prometheus catalog runs to tens of thousands of metric names and a high-cardinality label to
 * thousands of values, and every one of them would still be a DOM node.
 *
 * `resetKey` is whatever narrows the list (a search string, a filter). When it changes, paging
 * drops back to the first batch: keeping a grown offset would show a batch of a list the user never
 * paged through. It is adjusted during render rather than from the input's change handler because
 * the list and the control that narrows it are not always the same component.
 */
export function useVisibleBatch(resetKey: string): { visibleCount: number; showMore: () => void } {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const [activeKey, setActiveKey] = useState(resetKey);

  if (resetKey !== activeKey) {
    setActiveKey(resetKey);
    setVisibleCount(INITIAL_BATCH);
  }

  const showMore = useCallback(() => setVisibleCount((count) => count + INITIAL_BATCH), []);

  return { visibleCount, showMore };
}
