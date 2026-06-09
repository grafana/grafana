import { t } from '@grafana/i18n';

import { useIsAutoSyncActive } from './useIsAutoSyncActive';

export interface ImportEntrypointState {
  disabled: boolean;
  reason?: string;
}

export function useImportEntrypointState(): ImportEntrypointState {
  const isAutoSyncActive = useIsAutoSyncActive();
  if (isAutoSyncActive) {
    return {
      disabled: true,
      reason: t(
        'alerting.rule-list.import-disabled-tooltip.auto-sync',
        'Imports are unavailable while Mimir Alertmanager auto-sync is active'
      ),
    };
  }
  return { disabled: false };
}
