import { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime';

/**
 * Reports one page view per mount. The row count is the number of items
 * the API returned, not the number visible on screen.
 * Never include rule titles, UIDs, folder paths, or user identifiers.
 */
export function useTrackDeletedRulesPageView(apiRowCount: number | undefined) {
  useEffect(() => {
    if (apiRowCount === undefined) {
      return;
    }
    reportInteraction('grafana_alerting_gma_recently_deleted_viewed', { row_count: apiRowCount });
    // Once per load result: fires when the API count first becomes known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRowCount === undefined]);
}

export function trackReviewOpened() {
  reportInteraction('grafana_alerting_gma_recently_deleted_review_opened');
}

export function trackJsonOpened() {
  reportInteraction('grafana_alerting_gma_recently_deleted_json_opened');
}

export function trackRestoreAttempt() {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_attempt');
}

export function trackRestoreSuccess() {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_success');
}

export function trackRestoreFailure(reason: 'conflict' | 'error') {
  reportInteraction('grafana_alerting_gma_recently_deleted_restore_failure', { reason });
}
