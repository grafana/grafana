import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';

import { isFreeTierLicense } from '../../provisioning/utils/isFreeTierLicense';
import { type QuotaState, type ResourceStatus, useQuotaLimits } from '../hooks/useQuotaLimits';

const QUOTA_EXTENSION_URL = 'https://grafana.com/help';

export const DISMISS_STORAGE_KEY = 'grafana.quota-limit-banner.dismissed';

type DismissedMap = Record<string, boolean>;

function worstState(a: QuotaState, b: QuotaState): QuotaState {
  const order: Record<QuotaState, number> = { ok: 0, nearing: 1, at_limit: 2 };
  return order[a] >= order[b] ? a : b;
}

function getTitle(overallState: QuotaState): string {
  if (overallState === 'at_limit') {
    return t('browse-dashboards.quota-banner.at-limit-title', "You've hit your storage limits");
  }
  return t('browse-dashboards.quota-banner.nearing-title', "You're nearing your storage limits");
}

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

function getBodyText(overallState: QuotaState): string {
  if (overallState === 'at_limit') {
    return t('browse-dashboards.quota-banner.at-limit-body', 'Clean up unused resources to free up space.');
  }
  return t(
    'browse-dashboards.quota-banner.nearing-body',
    "New resources can't be created once the limit is reached. Clean up unused resources to free up space."
  );
}

export function QuotaLimitBanner() {
  const styles = useStyles2(getStyles);
  const { resources, isLoading, hasError, featureEnabled } = useQuotaLimits();

  const [dismissed, setDismissed] = useState<DismissedMap>(
    () => store.getObject<DismissedMap>(DISMISS_STORAGE_KEY) ?? {}
  );

  const visibleResources = resources.filter((r) => !(r.state === 'nearing' && dismissed[r.kind]));
  const overallState = visibleResources.reduce<QuotaState>((worst, r) => worstState(worst, r.state), 'ok');
  if (!featureEnabled || isLoading || hasError || overallState === 'ok') {
    return null;
  }

  const isPaying = !isFreeTierLicense();

  const handleDismiss = () => {
    const next = { ...dismissed };
    for (const r of visibleResources) {
      next[r.kind] = true;
    }
    store.setObject(DISMISS_STORAGE_KEY, next);
    setDismissed(next);
  };

  const handleRequestExtension = () => {
    window.open(QUOTA_EXTENSION_URL, '_blank');
  };

  const title = getTitle(overallState);
  const details = visibleResources.map((r) => formatDetail(r)).join(' ');
  const bodyText = getBodyText(overallState);

  return (
    <div className={styles.wrapper}>
      <Alert
        severity={overallState === 'at_limit' ? 'error' : 'warning'}
        title={title}
        onRemove={overallState !== 'at_limit' ? handleDismiss : undefined}
      >
        <Stack justifyContent="space-between" alignItems="center">
          {details} {bodyText}
          {isPaying && (
            <Button variant="primary" onClick={handleRequestExtension}>
              {t('browse-dashboards.quota-banner.request-extension', 'Request quota extension')}
            </Button>
          )}
        </Stack>
      </Alert>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
});
