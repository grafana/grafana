import { useCallback } from 'react';

import { contextSrv } from 'app/core/services/context_srv';
import { prometheusApi } from 'app/features/alerting/unified/api/prometheusApi';
import { AccessControlAction } from 'app/types/accessControl';

import { type LoadFilterOptions } from './LabelFilterCombobox';
import { canEncodeFilterLabel, encodeFilterLabel } from './filterSelection';

/**
 * Loads the labels set on the org's alert rules for the alerts filter dropdown: each value
 * under its label key, selecting to the encoded `key:value`. Undefined without permission to
 * read rules, so there's no dropdown.
 */
export function useAlertFilterOptions(enabled: boolean): LoadFilterOptions | undefined {
  const [fetchRuleLabels] = prometheusApi.useLazyGetGrafanaRuleLabelsQuery();

  // Fetched on open rather than on mount: listing labels downloads every rule in the org,
  // and most homepage visits never open the filter.
  const loadOptions = useCallback(async () => {
    try {
      // Reopening the dropdown or switching tabs reuses the cached labels.
      const labels = await fetchRuleLabels(undefined, true).unwrap();
      return labels
        .filter(canEncodeFilterLabel)
        .map((label) => ({ label: label.value, value: encodeFilterLabel(label), group: label.key }));
    } catch {
      // The labels are optional: the dropdown still offers its scope options without them.
      return [];
    }
  }, [fetchRuleLabels]);
  return enabled && contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) ? loadOptions : undefined;
}
