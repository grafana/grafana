import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';

import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { type RuleKind } from '../shared/ruleKind';

import { DeletedRulesTable } from './DeletedRulesTable';
import { RestoreModal } from './RestoreModal';
import { ReviewDrawer } from './ReviewDrawer';
import { trackJsonOpened, trackReviewOpened, useTrackDeletedRulesPageView } from './analytics';
import { type DeletedRule, type RuleRestorer, type UseDeletedRulesResult } from './deletedRulesPage';

/** Batch-resolves user UIDs to display names via IAM getDisplayMapping. */
function useDeletedByNames(rules: DeletedRule[]): Record<string, string> {
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

interface DeletedRulesViewProps<Rule extends DeletedRule> {
  kind: RuleKind;
  list: UseDeletedRulesResult<Rule>;
  restorer: RuleRestorer<Rule>;
  restoreTitle: string;
}

export function DeletedRulesView<Rule extends DeletedRule>({
  kind,
  list,
  restorer,
  restoreTitle,
}: DeletedRulesViewProps<Rule>) {
  const { items, hasMore, isLoading, isFetchingMore, error, failure, loadMore, retry, refetch, totalFromApi } = list;
  const [reviewing, setReviewing] = useState<Rule | null>(null);
  const [restoring, setRestoring] = useState<Rule | null>(null);
  const userNames = useDeletedByNames(items);

  useTrackDeletedRulesPageView(kind, totalFromApi);

  if (isLoading) {
    return <RuleListSkeleton />;
  }

  if ((error || failure) && items.length === 0) {
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
          trackReviewOpened(kind);
          setReviewing(rule);
        }}
        onRestore={setRestoring}
        hasMore={hasMore}
        isLoadingMore={isFetchingMore}
        failure={failure}
        onLoadMore={loadMore}
        onRetry={retry}
      />
      {reviewing && (
        <ReviewDrawer
          rule={reviewing}
          deletedByName={userNames[reviewing.metadata?.annotations?.['grafana.app/updatedBy'] ?? '']}
          onClose={() => setReviewing(null)}
          onJsonOpen={() => trackJsonOpened(kind)}
        />
      )}
      {restoring && (
        <RestoreModal
          kind={kind}
          rule={restoring}
          restorer={restorer}
          title={restoreTitle}
          onDismiss={() => setRestoring(null)}
          onRefetch={retry}
        />
      )}
    </>
  );
}
