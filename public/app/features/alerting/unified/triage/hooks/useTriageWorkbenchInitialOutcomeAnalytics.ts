import { useEffect, useRef } from 'react';

import { trackTriageWorkbenchOutcome } from '../../Analytics';

export interface TriageWorkbenchInitialOutcomeAnalyticsParams {
  isInitialLoading: boolean;
  /** Top-level workbench row count; 0 means empty state. */
  rowCount: number;
  hasActiveFilters: boolean;
}

/**
 * Reports `grafana_alerting_triage_workbench_outcome` once per mount when the first query settles.
 * Does not fire on later refreshes or filter changes.
 */
export function useTriageWorkbenchInitialOutcomeAnalytics({
  isInitialLoading,
  rowCount,
  hasActiveFilters,
}: TriageWorkbenchInitialOutcomeAnalyticsParams): void {
  const initialLoadOutcomeTrackedRef = useRef(false);

  useEffect(() => {
    if (isInitialLoading || initialLoadOutcomeTrackedRef.current) {
      return;
    }
    initialLoadOutcomeTrackedRef.current = true;
    trackTriageWorkbenchOutcome({
      outcome: rowCount === 0 ? 'empty' : 'results',
      has_active_filters: hasActiveFilters,
    });
  }, [isInitialLoading, rowCount, hasActiveFilters]);
}
