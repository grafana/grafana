import { useMemo } from 'react';

import { config } from '@grafana/runtime';

import { useImportEntrypointState } from '../../hooks/useImportEntrypointState';
import { getAlertManagerDataSources } from '../../utils/datasource';

import { useCanImportToGMA } from './useCanImportToGMA';

/**
 * Whether to promote the Import to GMA wizard on the rules list. The rules list has no
 * Alertmanager picker, so we show the banner whenever the user can import rules and there is
 * at least one external Alertmanager data source to import from.
 */
export function useShowImportToGMARulesBanner(): boolean {
  const { canImportRules } = useCanImportToGMA();
  const hasExternalAlertmanagers = useMemo(() => getAlertManagerDataSources().length > 0, []);
  // Suppress the promo while the import wizard is blocked
  const { disabled: importDisabled } = useImportEntrypointState();

  return (
    Boolean(config.featureToggles.alertingMigrationWizardUI) &&
    canImportRules &&
    hasExternalAlertmanagers &&
    !importDisabled
  );
}
