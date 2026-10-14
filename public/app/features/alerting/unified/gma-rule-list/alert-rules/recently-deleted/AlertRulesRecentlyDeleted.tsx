import { useCallback, useEffect, useRef } from 'react';

import { type AlertRule, useLazyListAlertRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { DeletedRuleReviewDrawer } from '../../recently-deleted/DeletedRuleReviewDrawer';
import { DeletedRulesTable } from '../../recently-deleted/DeletedRulesTable';
import { trackDeletedRulesLoadResult, trackDeletedRulesPageView } from '../../recently-deleted/analytics';
import { TRASH_PAGE_SIZE, type TrashFetchResult } from '../../recently-deleted/trashPagination';
import { TRASH_SELECTOR } from '../../recently-deleted/trashSelector';
import { useTrashCollection } from '../../recently-deleted/useTrashCollection';

function sortByDeletionTimeDesc(rules: AlertRule[]): AlertRule[] {
  // ISO-8601 timestamps sort chronologically as plain strings; missing ones sort last.
  return [...rules].sort((a, b) => {
    const aTime = a.metadata.deletionTimestamp ?? '';
    const bTime = b.metadata.deletionTimestamp ?? '';
    if (aTime === bTime) {
      return 0;
    }
    return aTime < bTime ? 1 : -1;
  });
}

/**
 * Recently deleted page body for Grafana-managed Alert rules.
 * FE-platform mounts this inside the routed page/tab shell - this component owns only the data
 * fetch, table, and Review drawer.
 */
export function AlertRulesRecentlyDeleted() {
  const [triggerList] = useLazyListAlertRuleQuery();

  const fetchPage = useCallback(
    async (continueToken?: string): Promise<TrashFetchResult<AlertRule>> => {
      const response = await triggerList({
        labelSelector: TRASH_SELECTOR,
        limit: TRASH_PAGE_SIZE,
        continue: continueToken,
      }).unwrap();
      return { items: response.items, continueToken: response.metadata.continue };
    },
    [triggerList]
  );

  const { rows, status, error, hasMore, isLoadingMore, loadMoreError, loadMore } = useTrashCollection(fetchPage);

  const reportedInitialLoad = useRef(false);
  const loadStartedAt = useRef(performance.now());
  useEffect(() => {
    trackDeletedRulesPageView('alert');
  }, []);
  useEffect(() => {
    if ((status === 'loaded' || status === 'error') && !reportedInitialLoad.current) {
      reportedInitialLoad.current = true;
      trackDeletedRulesLoadResult(
        'alert',
        status === 'loaded' ? 'success' : 'error',
        rows.length,
        Math.round(performance.now() - loadStartedAt.current)
      );
    }
  }, [status, rows.length]);

  return (
    <DeletedRulesTable
      rows={sortByDeletionTimeDesc(rows)}
      status={status}
      error={error}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      loadMoreError={loadMoreError}
      onLoadMore={loadMore}
      renderReview={(rule, onClose) => <DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={onClose} />}
    />
  );
}
