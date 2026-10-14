import { useEffect, useRef } from 'react';

import { type RuleKind } from '../shared/analytics';

import { trackDeletedRulesLoadResult, trackDeletedRulesPageView } from './analytics';

interface DeletedRulesLoadState {
  isLoading: boolean;
  error?: unknown;
  returnedCount?: number;
}

/** Reports the page view on mount, and the first load's outcome once it settles. */
export function useTrackDeletedRulesPage(kind: RuleKind, { isLoading, error, returnedCount }: DeletedRulesLoadState) {
  const loadStartedAt = useRef(performance.now());
  const reportedLoad = useRef(false);

  useEffect(() => {
    trackDeletedRulesPageView(kind);
  }, [kind]);

  useEffect(() => {
    if (isLoading || reportedLoad.current) {
      return;
    }
    reportedLoad.current = true;
    trackDeletedRulesLoadResult(
      kind,
      error === undefined ? 'success' : 'error',
      // What the API returned, not the rows revealed from it.
      returnedCount ?? 0,
      Math.round(performance.now() - loadStartedAt.current)
    );
  }, [kind, isLoading, error, returnedCount]);
}
