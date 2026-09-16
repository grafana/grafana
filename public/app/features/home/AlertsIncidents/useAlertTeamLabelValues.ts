import { useAsync } from 'react-use';

import { rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { fetchTagValues } from 'app/features/alerting/unified/triage/scene/tagKeysProviders';

const TEAM_VALUES_TIME_RANGE = { from: 'now-7d', to: 'now' };

/**
 * `team` label values seen on alerts over the last 7 days, from the state-history
 * Prometheus datasource — that's what the alertmanager matcher actually filters on,
 * not Grafana org teams. Undefined while loading, on error, or when the datasource
 * isn't configured, so the dropdown stays hidden in all three cases.
 */
export function useAlertTeamLabelValues(enabled: boolean): string[] | undefined {
  // Read at render time (not module scope) so tests can vary the config.
  const datasourceConfigured = Boolean(config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID);
  const shouldFetch = enabled && datasourceConfigured;

  // Fetched once per mount; the label-value set changes slowly enough that
  // client-side filtering over it covers the search box.
  const { value, loading, error } = useAsync(async () => {
    if (!shouldFetch) {
      return undefined;
    }
    const values = await fetchTagValues(rangeUtil.convertRawToRange(TEAM_VALUES_TIME_RANGE), 'team');
    return values.map((v) => String(v.value ?? v.text));
  }, [shouldFetch]);

  return loading || error ? undefined : value;
}
