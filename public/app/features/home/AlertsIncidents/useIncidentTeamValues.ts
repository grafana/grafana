import { skipToken } from '@reduxjs/toolkit/query';

import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

/**
 * Values of the org's `team` incident custom field, for the incidents team dropdown.
 * Undefined while loading or on any error (a 404 included) so the dropdown stays
 * hidden rather than showing an empty or stale list.
 */
export function useIncidentTeamValues(enabled: boolean): string[] | undefined {
  const { data, isLoading, error } = incidentsApi.useGetIncidentTeamValuesQuery(
    enabled ? { pluginId: SupportedPlugin.Irm } : skipToken
  );
  return isLoading || error ? undefined : data;
}
