import { skipToken } from '@reduxjs/toolkit/query';

import { incidentsApi, type IncidentFilterOption } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

// Stable so the combobox's sort memo doesn't rerun on every render while hidden.
const NO_OPTIONS: IncidentFilterOption[] = [];

/**
 * Values of the org's select-type incident custom fields, for the incidents filter dropdown.
 * Empty while loading or on any error (a 404 included) so the dropdown stays
 * hidden rather than showing a stale list.
 */
export function useIncidentFilterOptions(enabled: boolean): IncidentFilterOption[] {
  const { data, isLoading, error } = incidentsApi.useGetIncidentFilterOptionsQuery(
    enabled ? { pluginId: SupportedPlugin.Irm } : skipToken
  );
  return isLoading || error ? NO_OPTIONS : (data ?? NO_OPTIONS);
}
