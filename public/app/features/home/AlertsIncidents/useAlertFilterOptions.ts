import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { type ComboboxOption } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { prometheusApi } from 'app/features/alerting/unified/api/prometheusApi';
import { AccessControlAction } from 'app/types/accessControl';

import { canEncodeFilterLabel, encodeFilterLabel } from './teamFilter';

// Stable so the combobox's sort memo doesn't rerun on every render while hidden.
const NO_OPTIONS: Array<ComboboxOption<string>> = [];

/**
 * Labels set on the org's alert rules, shaped for the alerts filter dropdown: each value
 * under its label key, selecting to the encoded `key:value`. Empty while loading, on error,
 * or without permission to read rules, so the dropdown stays hidden.
 */
export function useAlertFilterOptions(enabled: boolean): Array<ComboboxOption<string>> {
  const shouldFetch = enabled && contextSrv.hasPermission(AccessControlAction.AlertingRuleRead);
  const { data, isLoading, error } = prometheusApi.useGetGrafanaRuleLabelsQuery(shouldFetch ? undefined : skipToken);
  const options = useMemo(
    () =>
      data
        ?.filter(canEncodeFilterLabel)
        .map((label) => ({ label: label.value, value: encodeFilterLabel(label), group: label.key })),
    [data]
  );
  return isLoading || error ? NO_OPTIONS : (options ?? NO_OPTIONS);
}
