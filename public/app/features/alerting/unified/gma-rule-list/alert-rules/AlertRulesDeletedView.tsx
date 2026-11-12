import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LoadingBar } from '@grafana/ui';

import { DeletedRulesTable } from '../deleted-rules/DeletedRulesTable';
import { RestoreModal } from '../deleted-rules/RestoreModal';
import { ReviewDrawer } from '../deleted-rules/ReviewDrawer';

import { useDeletedAlertRules } from './useDeletedAlertRules';

export function AlertRulesDeletedView() {
  const { items, hasMore, isLoading, isFetchingMore, error, loadMore, refetch } = useDeletedAlertRules();
  const [reviewing, setReviewing] = useState<AlertRule | null>(null);
  const [restoring, setRestoring] = useState<AlertRule | null>(null);

  if (isLoading) {
    return <LoadingBar width={300} />;
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
        userNames={{}}
        onReview={setReviewing}
        onRestore={setRestoring}
        hasMore={hasMore}
        isLoadingMore={isFetchingMore}
        onLoadMore={loadMore}
      />
      {reviewing && <ReviewDrawer rule={reviewing} folderPath="" onClose={() => setReviewing(null)} />}
      {restoring && (
        <RestoreModal
          rule={restoring}
          onDismiss={() => setRestoring(null)}
          onSuccess={() => {
            setRestoring(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
