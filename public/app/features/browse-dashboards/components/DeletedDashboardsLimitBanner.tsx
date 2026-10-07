import { useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useFlagDashboardRecentlyDeletedViaTrash } from '@grafana/runtime/internal';
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
  const viaTrash = useFlagDashboardRecentlyDeletedViaTrash();
  const { value: data } = useAsync(
    () => (viaTrash ? Promise.resolve(undefined) : deletedDashboardsCache.getAsTable()),
    [resultToken, viaTrash]
  );
  const [dismissed, setDismissed] = useState<boolean>(() => store.getObject(DISMISS_STORAGE_KEY) === true);

  if (dismissed) {
    return null;
  }

  // Both paths stop asking at DELETED_DASHBOARDS_LIMIT, so either can leave rows unseen. They
  // just find out differently: the trash fetch is told there is more, while the list path has
  // to infer it from the page it got.
  const atLimit = viaTrash
    ? deletedDashboardsCache.isTrashTruncated()
    : data !== undefined &&
      data.rows.length + (data.metadata.remainingItemCount ?? (data.metadata.continue ? 1 : 0)) >=
        DELETED_DASHBOARDS_LIMIT;

  if (!atLimit) {
    return null;
  }

  const handleDismiss = () => {
    store.setObject(DISMISS_STORAGE_KEY, true);
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      title={t('recently-deleted.limit-banner.at-limit-title', 'Showing at most {{limit}} deleted dashboards', {
        limit: DELETED_DASHBOARDS_LIMIT,
      })}
      onRemove={handleDismiss}
    >
      {/* No claim about which dashboards these are: with the flag on the order follows the
          chosen sort, so "the most recent" would not always be true. */}
      <Trans i18nKey="recently-deleted.limit-banner.at-limit-body" values={{ limit: DELETED_DASHBOARDS_LIMIT }}>
        This list is limited to {'{{limit}}'} dashboards. If more have been deleted, use the search box to find a
        specific one.
      </Trans>
    </Alert>
  );
}
