import { skipToken } from '@reduxjs/toolkit/query';

import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

// Stable so the combobox's sort memo doesn't rerun on every render while hidden.
const NO_VALUES: string[] = [];

/**
 * Values of the org's `team` incident custom field, for the incidents team dropdown.
 * Empty while loading or on any error (a 404 included) so the dropdown stays
 * hidden rather than showing a stale list.
 */
export function useIncidentTeamValues(enabled: boolean): string[] {
  const { data, isLoading, error } = incidentsApi.useGetIncidentTeamValuesQuery(
    enabled ? { pluginId: SupportedPlugin.Irm } : skipToken
  );
  return isLoading || error ? NO_VALUES : (data ?? NO_VALUES);
}
