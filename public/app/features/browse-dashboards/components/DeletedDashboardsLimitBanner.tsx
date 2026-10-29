import { useState } from 'react';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { DELETED_DASHBOARDS_LIMIT, deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';

export const DISMISS_STORAGE_KEY = 'grafana.recently-deleted-limit-banner.dismissed';

// Read during render, so it is current whenever the page re-renders after a search completes.
export function DeletedDashboardsLimitBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => store.getObject(DISMISS_STORAGE_KEY) === true);

  if (dismissed || !deletedDashboardsCache.isTrashTruncated()) {
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
      {/* No claim about which dashboards these are: the order follows the chosen sort, so
          "the most recent" would not always be true. */}
      <Trans i18nKey="recently-deleted.limit-banner.at-limit-body" values={{ limit: DELETED_DASHBOARDS_LIMIT }}>
        This list is limited to {'{{limit}}'} dashboards. If more have been deleted, use the search box to find a
        specific one.
      </Trans>
    </Alert>
  );
}
