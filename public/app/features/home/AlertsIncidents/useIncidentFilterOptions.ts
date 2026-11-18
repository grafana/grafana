import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { type LoadFilterOptions } from './LabelFilterCombobox';
import { encodeFilterLabel } from './filterSelection';

/**
 * Values of the org's incident label fields for the incidents filter dropdown: each value
 * under its field's name, selecting to the encoded `slug:value`. Undefined while loading,
 * on any error (a 404 included) or with no label fields, so there's no dropdown rather
 * than a stale list.
 */
export function useIncidentFilterOptions(enabled: boolean): LoadFilterOptions | undefined {
  const { data, isLoading, error } = incidentsApi.useGetIncidentFilterOptionsQuery(
    enabled ? { pluginId: SupportedPlugin.Irm } : skipToken
  );
  const options = useMemo(
    () =>
      (data ?? []).map((option) => ({
        label: option.value,
        // Field slugs are identifiers, so they never hold the ':' that ends a key.
        value: encodeFilterLabel({ key: option.slug, value: option.value }),
        group: option.fieldName,
      })),
    [data]
  );
  const loadOptions = useCallback(async () => options, [options]);
  return isLoading || error || options.length === 0 ? undefined : loadOptions;
}
