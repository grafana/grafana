import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

import { grafanaRulesNav } from '../../utils/navigation';
import { DeletedRulesTable } from '../deleted-rules/DeletedRulesTable';
import { RestoreModal } from '../deleted-rules/RestoreModal';
import { ReviewDrawer } from '../deleted-rules/ReviewDrawer';
import {
  trackRecordingRuleJsonOpened,
  trackRecordingRuleRestoreAttempt,
  trackRecordingRuleRestoreFailure,
  trackRecordingRuleRestoreSuccess,
  trackRecordingRuleReviewOpened,
  useTrackDeletedRecordingRulesPageView,
} from '../deleted-rules/analytics';
import { useRestoreRecordingRule } from '../deleted-rules/useRestoreRecordingRule';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';

import { useDeletedRecordingRules } from './useDeletedRecordingRules';

function useDeletedByNames(rules: RecordingRule[]): Record<string, string> {
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

  const iamKeys = userUids.map((uid) => (uid.includes(':') ? uid : `user:${uid}`));
  const { data } = useGetDisplayMappingQuery(iamKeys.length > 0 ? { key: iamKeys } : skipToken);

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of data?.display ?? []) {
      if (entry.identity.type && entry.identity.name) {
        map[`${entry.identity.type}:${entry.identity.name}`] = entry.displayName;
        map[entry.identity.name] = entry.displayName;
      }
    }
    return map;
  }, [data]);
}

export function RecordingRulesDeletedView() {
  const { items, hasMore, isLoading, isFetchingMore, error, loadMore, refetch, totalFromApi } =
    useDeletedRecordingRules();
  const [reviewing, setReviewing] = useState<RecordingRule | null>(null);
  const [restoring, setRestoring] = useState<RecordingRule | null>(null);
  const userNames = useDeletedByNames(items);
  const { restore, isRestoring } = useRestoreRecordingRule();

  useTrackDeletedRecordingRulesPageView(totalFromApi);

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
          trackRecordingRuleReviewOpened();
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
          onJsonOpen={trackRecordingRuleJsonOpened}
        />
      )}
      {restoring && (
        <RestoreModal
          rule={restoring}
          restore={restore}
          isRestoring={isRestoring}
          navigateAfterRestore={(uid) => locationService.push(grafanaRulesNav.editLink(uid))}
          title={t('alerting.recently-deleted.restore.recording-title', 'Restore recording rule')}
          onAttempt={trackRecordingRuleRestoreAttempt}
          onSuccess={trackRecordingRuleRestoreSuccess}
          onFailure={trackRecordingRuleRestoreFailure}
          onDismiss={() => setRestoring(null)}
          onRefetch={refetch}
        />
      )}
    </>
  );
}
