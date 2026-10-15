import { useCallback, useState } from 'react';

export interface DefaultSavedSearchGate {
  applyDefault: boolean;
  /** False until the default is applied or ruled out; results are held back until then. */
  settled: boolean;
  onSettled: () => void;
}

/** Decides once per mount so no unfiltered request precedes the default; later URL changes never bring it back. */
export function useDefaultSavedSearchGate(hasSearchQuery: boolean): DefaultSavedSearchGate {
  const [applyDefault] = useState(!hasSearchQuery);
  const [settled, setSettled] = useState(hasSearchQuery);
  const onSettled = useCallback(() => setSettled(true), []);

  return { applyDefault, settled, onSettled };
}
