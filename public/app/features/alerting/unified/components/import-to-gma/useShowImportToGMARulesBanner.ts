import { useMemo } from 'react';

import { config } from '@grafana/runtime';

import { useImportEntrypointState } from '../../hooks/useImportEntrypointState';
import { getRulesDataSources } from '../../utils/datasource';

import { useCanImportToGMA } from './useCanImportToGMA';

/**
 * Whether to promote the Import to GMA wizard on the rules list. The rules list has no
 * Alertmanager picker, so we show the banner whenever the user can import rules and there is
 * at least one data source-managed rule source (Prometheus/Loki) to import from.
 */
export function useShowImportToGMARulesBanner(): boolean {
  const { canImportRules } = useCanImportToGMA();
  const hasExternalRulesSources = useMemo(() => getRulesDataSources().length > 0, []);
  const { disabled: importDisabled, isLoading: importStateLoading } = useImportEntrypointState();

  return (
    Boolean(config.featureToggles.alertingMigrationWizardUI) &&
    canImportRules &&
    hasExternalRulesSources &&
    !importDisabled &&
    !importStateLoading
  );
}
