import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';

import { isFreeTierLicense } from '../../provisioning/utils/isFreeTierLicense';
import { type ResourceStatus, useQuotaLimits } from '../hooks/useQuotaLimits';

const QUOTA_EXTENSION_URL = 'https://grafana.com/help';

export const DISMISS_STORAGE_KEY = 'grafana.quota-limit-banner.dismissed';

type DismissedMap = Record<string, boolean>;

function formatDetail(resource: ResourceStatus): string {
  const percentage = Math.round((resource.usage / resource.limit) * 100);
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
  const { resources, isLoading, hasError, featureEnabled } = useQuotaLimits();

  const [dismissed, setDismissed] = useState<DismissedMap>(
    () => store.getObject<DismissedMap>(DISMISS_STORAGE_KEY) ?? {}
  );

  const visibleResources = resources.filter((r) => !(r.state === 'nearing' && dismissed[r.kind]));
  if (!featureEnabled || isLoading || hasError || visibleResources.length === 0) {
    return null;
  }

  const atLimitResources = visibleResources.filter((r) => r.state === 'at_limit');
  const nearingResources = visibleResources.filter((r) => r.state === 'nearing');
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

  return (
    <div className={styles.wrapper}>
      {atLimitResources.length > 0 && (
        <Alert
          severity="error"
          title={t('browse-dashboards.quota-banner.at-limit-title', "You've hit your storage limits")}
        >
          <Stack justifyContent="space-between" alignItems="center">
            {atLimitResources.map((r) => formatDetail(r)).join(' ')}{' '}
            <Trans i18nKey="browse-dashboards.quota-banner.at-limit-body">
              Clean up unused resources to free up space.
            </Trans>
            {isPaying && (
              <Button variant="primary" onClick={handleRequestExtension}>
                <Trans i18nKey="browse-dashboards.quota-banner.request-extension">Request quota extension</Trans>
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {nearingResources.length > 0 && (
        <Alert
          severity="warning"
          title={t('browse-dashboards.quota-banner.nearing-title', "You're nearing your storage limits")}
          onRemove={handleDismiss}
        >
          <Stack justifyContent="space-between" alignItems="center">
            {nearingResources.map((r) => formatDetail(r)).join(' ')}{' '}
            <Trans i18nKey="browse-dashboards.quota-banner.nearing-body">
              New resources can&apos;t be created once the limit is reached. Clean up unused resources to free up space.
            </Trans>
            {isPaying && (
              <Button variant="primary" onClick={handleRequestExtension}>
                <Trans i18nKey="browse-dashboards.quota-banner.request-extension">Request quota extension</Trans>
              </Button>
            )}
          </Stack>
        </Alert>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
});
