import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

import { DeletedRulesTable } from '../deleted-rules/DeletedRulesTable';
import { RestoreModal } from '../deleted-rules/RestoreModal';
import { ReviewDrawer } from '../deleted-rules/ReviewDrawer';
import { trackJsonOpened, trackReviewOpened, useTrackDeletedRulesPageView } from '../deleted-rules/analytics';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';

import { useDeletedAlertRules } from './useDeletedAlertRules';

export function AlertRulesDeletedView() {
  const { items, hasMore, isLoading, isFetchingMore, error, loadMore, refetch, totalFromApi } = useDeletedAlertRules();
  const [reviewing, setReviewing] = useState<AlertRule | null>(null);
  const [restoring, setRestoring] = useState<AlertRule | null>(null);

  useTrackDeletedRulesPageView(totalFromApi);

  // Collect unique updatedBy UIDs to batch-resolve display names
  const userUids = useMemo(() => {
    const uids = new Set<string>();
    for (const item of items) {
      const uid = item.metadata?.annotations?.['grafana.app/updatedBy'];
      if (uid) {
        uids.add(uid);
      }
    }
    return Array.from(uids);
  }, [items]);

  const { data: displayData } = useGetDisplayMappingQuery(
    userUids.length > 0 ? { key: userUids.map((uid) => `user:${uid}`) } : skipToken
  );

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of displayData?.display ?? []) {
      if (entry.identity.name) {
        map[entry.identity.name] = entry.displayName;
      }
    }
    return map;
  }, [displayData]);

  if (isLoading) {
    return <RuleListSkeleton />;
  }

  if (error && items.length === 0) {
    return (
      <Alert title={t('alerting.recently-deleted.error', 'Failed to load deleted rules')} severity="error">
        <Button variant="secondary" onClick={refetch}>
          <Trans i18nKey="alerting.recently-deleted.retry">Retry</Trans>
        </Button>
      </Alert>
    );
  }

  return (
    <>
      <DeletedRulesTable
        rules={items}
        folderPaths={{}}
        userNames={userNames}
        onReview={(rule) => {
          trackReviewOpened();
          setReviewing(rule);
        }}
        onRestore={setRestoring}
        hasMore={hasMore}
        isLoadingMore={isFetchingMore}
        onLoadMore={loadMore}
      />
      {reviewing && <ReviewDrawer rule={reviewing} onClose={() => setReviewing(null)} onJsonOpen={trackJsonOpened} />}
      {restoring && (
        <RestoreModal
          rule={restoring}
          onDismiss={() => setRestoring(null)}
          onSuccess={() => setRestoring(null)}
          onRefetch={refetch}
        />
      )}
    </>
  );
}
