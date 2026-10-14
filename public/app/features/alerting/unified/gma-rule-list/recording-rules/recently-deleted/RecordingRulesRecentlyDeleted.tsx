import { useCallback, useEffect, useRef } from 'react';

import { type RecordingRule, useLazyListRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type Column } from '@grafana/ui';

import { DeletedRuleReviewDrawer } from '../../recently-deleted/DeletedRuleReviewDrawer';
import { DeletedRulesTable } from '../../recently-deleted/DeletedRulesTable';
import { trackDeletedRulesLoadResult, trackDeletedRulesPageView } from '../../recently-deleted/analytics';
import { TRASH_PAGE_SIZE, type TrashFetchResult } from '../../recently-deleted/trashPagination';
import { TRASH_SELECTOR } from '../../recently-deleted/trashSelector';
import { useTrashCollection } from '../../recently-deleted/useTrashCollection';

function sortByDeletionTimeDesc(rules: RecordingRule[]): RecordingRule[] {
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

function TargetDataSourceCell({ uid }: { uid: string }) {
  const { settings } = useDataSourceInstanceSettings(uid);
  return <>{settings?.name ?? uid}</>;
}

function useExtraColumns(): Array<Column<RecordingRule>> {
  return [
    {
      id: 'metric',
      header: t('alerting.deleted-rules.table.recorded-metric', 'Recorded metric'),
      cell: ({ row }) => row.original.spec.metric,
    },
    {
      id: 'targetDataSource',
      header: t('alerting.deleted-rules.table.target-data-source', 'Target data source'),
      cell: ({ row }) => <TargetDataSourceCell uid={row.original.spec.targetDatasourceUID} />,
    },
  ];
}

/**
 * Recently deleted page body for Grafana-managed Recording rules.
 * FE-platform mounts this inside the routed page/tab shell - this component owns only the data
 * fetch, table, and Review drawer.
 */
export function RecordingRulesRecentlyDeleted() {
  const [triggerList] = useLazyListRecordingRuleQuery();
  const extraColumns = useExtraColumns();

  const fetchPage = useCallback(
    async (continueToken?: string): Promise<TrashFetchResult<RecordingRule>> => {
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
    trackDeletedRulesPageView('recording');
  }, []);
  useEffect(() => {
    if ((status === 'loaded' || status === 'error') && !reportedInitialLoad.current) {
      reportedInitialLoad.current = true;
      trackDeletedRulesLoadResult(
        'recording',
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
      renderReview={(rule, onClose) => <DeletedRuleReviewDrawer kind="recording" rule={rule} onClose={onClose} />}
      extraColumns={extraColumns}
    />
  );
}
