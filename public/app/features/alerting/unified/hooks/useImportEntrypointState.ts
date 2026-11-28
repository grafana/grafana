import { t } from '@grafana/i18n';

import { useIsAutoSyncActive } from './useIsAutoSyncActive';

export interface ImportEntrypointState {
  disabled: boolean;
  reason?: string;
  isLoading: boolean;
}

/**
 * Gates the entry points that promote importing Alertmanager resources (the import wizard promo
 * banners): the convert endpoint rejects those with a 409 while external Alertmanager sync is
 * configured. Rules-only import is unaffected — the sync worker never touches alert rules and the
 * rule convert endpoints have no sync check — so entry points that also lead to rule import (like
 * the wizard menu item, which locks only its notifications step) must not use this hook.
 */
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
