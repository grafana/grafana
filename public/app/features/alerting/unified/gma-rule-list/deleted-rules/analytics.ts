import { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { type RuleKind } from '../shared/ruleKind';

/**
 * Reports one page view per mount. The row count is the number of items
 * the API returned, not the number visible on screen.
 * Never include rule titles, UIDs, folder paths, or user identifiers.
 */
export function useTrackDeletedRulesPageView(kind: RuleKind, apiRowCount: number | undefined) {
  useEffect(() => {
    if (apiRowCount === undefined) {
      return;
    }
    reportInteraction('grafana_alerting_gma_recently_deleted_viewed', { kind, row_count: apiRowCount });
    // Once per load result: fires when the API count first becomes known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRowCount === undefined]);
}

export function trackReviewOpened(kind: RuleKind) {
  reportInteraction('grafana_alerting_gma_recently_deleted_review_opened', { kind });
}

export function trackJsonOpened(kind: RuleKind) {
  reportInteraction('grafana_alerting_gma_recently_deleted_json_opened', { kind });
}

export function trackRestoreAttempt(kind: RuleKind) {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_attempt', { kind });
}

export function trackRestoreSuccess(kind: RuleKind) {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_success', { kind });
}

export function trackRestoreFailure(kind: RuleKind, reason: 'conflict' | 'error') {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_failure', { kind, reason });
}
