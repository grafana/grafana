import { type DataSourceInstanceListItem, type DataSourceInstanceSettings, type FieldSparkline } from '@grafana/data';

import { PROBE_TIMEOUT_MS } from './probeUtils';
import { readLabeledScalar, readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';
import { CLOUD_UTILITY_PROM_DATASOURCE_UIDS, probeFound } from './solutionDataProbes';

export interface SyntheticsStats {
  checks: number | null;
  successRatio: number | null;
}

export interface SyntheticsHealth {
  failing: number | null;
  worstCheck: string | null;
  worstRatio: number | null;
}

// "Seen recently" lookback matching the shared data probes.
const SM_LOOKBACK = '24h';

// A check = one (job, instance) pair; sm_check_info has one series per probe location.
const SM_CHECK_PROBE = `count(count by (job, instance) (last_over_time(sm_check_info[${SM_LOOKBACK}])))`;

// Success ratio below this over the last hour puts a check in the attention group. The 1h
// window keeps the alert about current breakage; the stats secondary deliberately reports
// the 24h fleet ratio instead, matching its "% success · 24h" copy.
const SM_ATTENTION_RATIO = 0.9;
const SM_SUCCESS_RATIO_1H =
  'sum by (job, instance) (rate(probe_all_success_sum[1h])) / sum by (job, instance) (rate(probe_all_success_count[1h]))';

const STATS_QUERIES: Record<string, string> = {
  checks: SM_CHECK_PROBE,
  successRatio: `sum(rate(probe_all_success_sum[${SM_LOOKBACK}])) / sum(rate(probe_all_success_count[${SM_LOOKBACK}]))`,
};

const HEALTH_QUERIES: Record<string, string> = {
  failing: `count((${SM_SUCCESS_RATIO_1H}) < ${SM_ATTENTION_RATIO})`,
  worst: `bottomk(1, (${SM_SUCCESS_RATIO_1H}) < ${SM_ATTENTION_RATIO})`,
};

// Single attempt inside the probe timeout; errors read as no data in the parallel scan.
async function hasSyntheticChecks(ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>): Promise<boolean> {
  const frames = await runInstantQueries({ checks: SM_CHECK_PROBE }, ds, PROBE_TIMEOUT_MS);
  return (readScalar(frames, 'checks') ?? 0) > 0;
}

/** Resolved Prometheus datasource with Synthetic Monitoring data, or null when none. */
export function probeSyntheticChecks(): Promise<DataSourceInstanceListItem | null> {
  return probeFound('prometheus', hasSyntheticChecks, CLOUD_UTILITY_PROM_DATASOURCE_UIDS);
}

/** Check count and fleet success ratio over the stats lookback. */
export async function fetchSyntheticsStats(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<SyntheticsStats> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(STATS_QUERIES, ds, undefined, true);
  return {
    checks: readScalar(frames, 'checks'),
    successRatio: readScalar(frames, 'successRatio'),
  };
}

/** Failing-check count and the worst offender over the last hour. Empty vectors read as null. */
export async function fetchSyntheticsHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<SyntheticsHealth> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(HEALTH_QUERIES, ds, undefined, true);
  // A check is a (job, instance) pair and several checks can share a job name; fall back to
  // the target (instance) when the job label is missing.
  const worst = readLabeledScalar(frames, 'worst', 'job');
  const worstInstance = readLabeledScalar(frames, 'worst', 'instance');
  return {
    failing: readScalar(frames, 'failing'),
    worstCheck: worst?.label ?? worstInstance?.label ?? null,
    worstRatio: worst?.value ?? null,
  };
}

/** Fleet success ratio over 24h; null when the probe metrics are absent. */
export async function fetchSyntheticsSuccessSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'success',
    // [1h] rate window: check cadence is configurable up to one run per hour and rate() needs
    // two samples in the window; [5m] would blank the trend for slow fleets.
    'sum(rate(probe_all_success_sum[1h])) / sum(rate(probe_all_success_count[1h]))',
    24,
    ds
  );
  return readSeries(frames, 'success');
}
