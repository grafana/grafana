import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

import { grafanaRulesNav } from '../../utils/navigation';
import { DeletedRulesTable } from '../deleted-rules/DeletedRulesTable';
import { RestoreModal } from '../deleted-rules/RestoreModal';
import { ReviewDrawer } from '../deleted-rules/ReviewDrawer';
import {
  trackJsonOpened,
  trackRestoreAttempt,
  trackRestoreFailure,
  trackRestoreSuccess,
  trackReviewOpened,
  useTrackDeletedRulesPageView,
} from '../deleted-rules/analytics';
import { useRestoreAlertRule } from '../deleted-rules/useRestoreRule';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';

import { useDeletedAlertRules } from './useDeletedAlertRules';

/** Batch-resolves user UIDs to display names via IAM getDisplayMapping. */
function useDeletedByNames(rules: AlertRule[]): Record<string, string> {
  const userUids = useMemo(() => {
    const uids = new Set<string>();
    for (const rule of rules) {
      const uid = rule.metadata?.annotations?.['grafana.app/updatedBy'];
      if (uid) {
        uids.add(uid);
      }
    }
    return Array.from(uids);
  }, [rules]);

  // The annotation may already be an identity ref ("user:<uid>") or a raw UID.
  // Normalise to "user:<uid>" for the IAM key without double-prefixing.
  const iamKeys = userUids.map((uid) => (uid.includes(':') ? uid : `user:${uid}`));

  const { data } = useGetDisplayMappingQuery(iamKeys.length > 0 ? { key: iamKeys } : skipToken);

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of data?.display ?? []) {
      if (entry.identity.type && entry.identity.name) {
        // Store under both "user:<name>" and raw "<name>" to handle annotations
        // that may carry either an identity ref or a plain UID.
        map[`${entry.identity.type}:${entry.identity.name}`] = entry.displayName;
        map[entry.identity.name] = entry.displayName;
      }
    }
    return map;
  }, [data]);
}

export function AlertRulesDeletedView() {
  const { items, hasMore, isLoading, isFetchingMore, error, loadMore, refetch, totalFromApi } = useDeletedAlertRules();
  const [reviewing, setReviewing] = useState<AlertRule | null>(null);
  const [restoring, setRestoring] = useState<AlertRule | null>(null);
  const userNames = useDeletedByNames(items);
  const { restore, isRestoring } = useRestoreAlertRule();

  useTrackDeletedRulesPageView(totalFromApi);

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
      {reviewing && (
        <ReviewDrawer
          rule={reviewing}
          deletedByName={userNames[reviewing.metadata?.annotations?.['grafana.app/updatedBy'] ?? '']}
          onClose={() => setReviewing(null)}
          onJsonOpen={trackJsonOpened}
        />
      )}
      {restoring && (
        <RestoreModal
          rule={restoring}
          restore={restore}
          isRestoring={isRestoring}
          navigateAfterRestore={(uid) => locationService.push(grafanaRulesNav.viewLink(uid, { includeReturnTo: true }))}
          onAttempt={trackRestoreAttempt}
          onSuccess={trackRestoreSuccess}
          onFailure={trackRestoreFailure}
          onDismiss={() => setRestoring(null)}
          onRefetch={refetch}
        />
      )}
    </>
  );
}
