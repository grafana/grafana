import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, IconButton, useStyles2 } from '@grafana/ui';

import { isFreeTierLicense } from '../../provisioning/utils/isFreeTierLicense';
import { type ResourceStatus, useQuotaLimits } from '../hooks/useQuotaLimits';

const QUOTA_EXTENSION_URL = 'https://grafana.com/help';

export const DISMISS_STORAGE_KEY = 'grafana.quota-limit-banner.dismissed';

type DismissedMap = Record<string, boolean>;

function formatDetail(resource: ResourceStatus): string {
  const percentage = Math.floor((resource.usage / resource.limit) * 100);
  const values = {
    usage: resource.usage.toLocaleString(),
    limit: resource.limit.toLocaleString(),
    percentage,
  };
  if (resource.kind === 'dashboards') {
    return t(
      'browse-dashboards.quota-banner.resource-detail-dashboards',
      "You've created {{usage}} of {{limit}} dashboards ({{percentage}}%).",
      values
    );
  }
  return t(
    'browse-dashboards.quota-banner.resource-detail-folders',
    "You've created {{usage}} of {{limit}} folders ({{percentage}}%).",
    values
  );
}

export function QuotaLimitBanner() {
  const styles = useStyles2(getStyles);
  const { resources, isLoading, allQueriesFailed, featureEnabled } = useQuotaLimits();
  const [dismissed, setDismissed] = useState<DismissedMap>(
    () => store.getObject<DismissedMap>(DISMISS_STORAGE_KEY) ?? {}
  );

  const atLimitResources = resources.filter((r) => r.state === 'at_limit');
  const nearingResources = resources.filter((r) => r.state === 'nearing' && !dismissed[r.kind]);

  if (!featureEnabled || isLoading || allQueriesFailed || (!atLimitResources.length && !nearingResources.length)) {
    return null;
  }

  const isPaying = !isFreeTierLicense();

  const handleDismiss = () => {
    const next = { ...dismissed };
    for (const r of nearingResources) {
      next[r.kind] = true;
    }
    store.setObject(DISMISS_STORAGE_KEY, next);
    setDismissed(next);
  };

  const handleRequestExtension = () => {
    window.open(QUOTA_EXTENSION_URL, '_blank');
  };

  const extensionProps = isPaying
    ? {
        onRemove: handleRequestExtension,
        buttonContent: t('browse-dashboards.quota-banner.request-extension', 'Request quota extension'),
      }
    : {};

  return (
    <>
      {atLimitResources.length > 0 && (
        <Alert
          severity="error"
          title={t('browse-dashboards.quota-banner.at-limit-title', "You've hit your storage limits")}
          {...extensionProps}
        >
          {atLimitResources.map((r) => formatDetail(r)).join(' ')}{' '}
          <Trans i18nKey="browse-dashboards.quota-banner.at-limit-body">
            Clean up unused resources to free up space.
          </Trans>
        </Alert>
      )}
      {nearingResources.length > 0 && (
        <Alert
          severity="warning"
          title={t('browse-dashboards.quota-banner.nearing-title', "You're nearing your storage limits")}
          {...extensionProps}
        >
          {nearingResources.map((r) => formatDetail(r)).join(' ')}{' '}
          <Trans i18nKey="browse-dashboards.quota-banner.nearing-body">
            New resources can&apos;t be created once the limit is reached. Clean up unused resources to free up space.
          </Trans>
          {/* Alert doesn't support showing both buttonContent and a close icon, so we position dismiss manually */}
          <div className={styles.dismiss}>
            <IconButton
              aria-label={t('browse-dashboards.quota-banner.dismiss', 'Dismiss')}
              name="times"
              onClick={handleDismiss}
            />
          </div>
        </Alert>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dismiss: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.25),
  }),
});
