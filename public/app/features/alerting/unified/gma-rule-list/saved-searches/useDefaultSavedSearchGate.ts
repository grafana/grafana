import { useCallback, useState } from 'react';

export interface DefaultSavedSearchGate {
  /** Whether the page opened with no query, which is the only time the default search applies. */
  applyDefault: boolean;
  /** False until the default search has been applied or ruled out; the page holds its results back until then. */
  settled: boolean;
  onSettled: () => void;
}

/**
 * Decides once per page mount whether the default saved search applies, so the page does not
 * request an unfiltered list that the default search would immediately replace. Later URL
 * changes, such as clearing the filters, never bring the default back.
 */
export function useDefaultSavedSearchGate(hasSearchQuery: boolean): DefaultSavedSearchGate {
  const [applyDefault] = useState(!hasSearchQuery);
  const [settled, setSettled] = useState(hasSearchQuery);
  const onSettled = useCallback(() => setSettled(true), []);

  return { applyDefault, settled, onSettled };
}
