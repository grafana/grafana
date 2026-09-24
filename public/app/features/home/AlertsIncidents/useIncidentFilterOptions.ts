import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { type ComboboxOption } from '@grafana/ui';
import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { encodeIncidentFilter } from './incidentFilter';

// Stable so the combobox's sort memo doesn't rerun on every render while hidden.
const NO_OPTIONS: Array<ComboboxOption<string>> = [];

/**
 * Values of the org's incident label fields, shaped for the incidents filter dropdown:
 * each value under its field's name, selecting to the encoded `slug:value`.
 * Empty while loading or on any error (a 404 included) so the dropdown stays
 * hidden rather than showing a stale list.
 */
export function useIncidentFilterOptions(enabled: boolean): Array<ComboboxOption<string>> {
  const { data, isLoading, error } = incidentsApi.useGetIncidentFilterOptionsQuery(
    enabled ? { pluginId: SupportedPlugin.Irm } : skipToken
  );
  const options = useMemo(
    () =>
      data?.map((option) => ({
        label: option.value,
        value: encodeIncidentFilter(option),
        group: option.fieldName,
      })),
    [data]
  );
  return isLoading || error ? NO_OPTIONS : (options ?? NO_OPTIONS);
}
