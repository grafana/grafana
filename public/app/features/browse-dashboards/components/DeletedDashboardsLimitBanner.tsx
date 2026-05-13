import { useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

export const DELETED_DASHBOARDS_LIMIT = 1000;
export const DISMISS_STORAGE_KEY = 'grafana.recently-deleted-limit-banner.dismissed';

interface Props {
  /**
   * Trigger used to re-read the cache after mutations. Pass the page's
   * `searchState.result` so the banner refreshes whenever a completed
   * search replaces the reference (which happens after every delete / restore
   * cycle that invalidates the cache).
   */
  resultToken: unknown;
}

export function DeletedDashboardsLimitBanner({ resultToken }: Props) {
  const { value: data } = useAsync(() => deletedDashboardsCache.getAsResourceList(), [resultToken]);
  const [dismissed, setDismissed] = useState<boolean>(() => store.getObject(DISMISS_STORAGE_KEY) === true);

  if (!data || dismissed) {
    return null;
  }

  const count = data.items.length;
  const lowerBoundOfMissing = data.metadata.remainingItemCount ?? (data.metadata.continue ? 1 : 0);
  const atLimit = count + lowerBoundOfMissing >= DELETED_DASHBOARDS_LIMIT;

  if (!atLimit) {
    return null;
  }

  const handleDismiss = () => {
    store.setObject(DISMISS_STORAGE_KEY, true);
    setDismissed(true);
  };

  return (
    <Alert
      severity="warning"
      title={t('recently-deleted.limit-banner.at-limit-title', 'Deleted dashboards limit reached')}
      onRemove={handleDismiss}
    >
      <Trans i18nKey="recently-deleted.limit-banner.at-limit-body" values={{ limit: DELETED_DASHBOARDS_LIMIT }}>
        Grafana retains up to {'{{limit}}'} recently deleted dashboards. Older entries are permanently removed.
      </Trans>
    </Alert>
  );
}
