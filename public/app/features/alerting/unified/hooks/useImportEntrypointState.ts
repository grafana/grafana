import { t } from '@grafana/i18n';

import { useIsAutoSyncActive } from './useIsAutoSyncActive';

export interface ImportEntrypointState {
  disabled: boolean;
  reason?: string;
  isLoading: boolean;
}

export function useImportEntrypointState(): ImportEntrypointState {
  const { isActive, isLoading } = useIsAutoSyncActive();
  if (isActive) {
    return {
      disabled: true,
      reason: t(
        'alerting.rule-list.import-disabled-tooltip.auto-sync',
        'Imports are unavailable while Mimir Alertmanager auto-sync is active'
      ),
      isLoading,
    };
  }
  return { disabled: false, isLoading };
}
