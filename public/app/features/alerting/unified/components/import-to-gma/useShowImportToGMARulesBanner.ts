import { useIsAlertmanagerImportEnabled } from '../../featureToggles';
import { useDataSourcesForRules } from '../../hooks/useDataSourcesForRules';
import { useImportEntrypointState } from '../../hooks/useImportEntrypointState';
import { isAdmin } from '../../utils/environment';

import { useCanImportToGMA } from './useCanImportToGMA';

/**
 * Whether to promote the Import to GMA wizard on the rules list. The rules list has no
 * Alertmanager picker, so we show the banner whenever the user can import rules and there is
 * at least one data source-managed rule source (Prometheus/Loki) to import from. The wizard lives on the
 * admin-only Settings > Import tab, so only admins see it.
 */
export function useShowImportToGMARulesBanner(): boolean {
  const { canImportRules } = useCanImportToGMA();
  const hasExternalRulesSources = useDataSourcesForRules().items.length > 0;
  const { disabled: importDisabled, isLoading: importStateLoading } = useImportEntrypointState();
  const alertmanagerImportEnabled = useIsAlertmanagerImportEnabled();

  return (
    alertmanagerImportEnabled &&
    isAdmin() &&
    canImportRules &&
    hasExternalRulesSources &&
    !importDisabled &&
    !importStateLoading
  );
}
