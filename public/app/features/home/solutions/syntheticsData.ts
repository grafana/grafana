import { type DataSourceInstanceListItem, type DataSourceInstanceSettings, type FieldSparkline } from '@grafana/data';

import { PROBE_TIMEOUT_MS } from './probeUtils';
import {
  quotePromAlternation,
  readLabeledScalar,
  readScalar,
  readSeries,
  runInstantQueries,
  runRangeQuery,
} from './promQuery';
import { CLOUD_UTILITY_PROM_DATASOURCE_UIDS, probeFound } from './solutionDataProbes';

export interface SyntheticsStats {
  /** Distinct checks: 0 for a confirmed empty (scoped) fleet, null when the count query failed. */
  checks: number | null;
  successRatio: number | null;
}

export interface SyntheticsHealth {
  failing: number | null;
  worstCheck: string | null;
  worstRatio: number | null;
}

/** sm_check_info labels an ignore list targets: check job, target, probe location. */
export const IGNORE_LABELS = ['job', 'instance', 'probe'] as const;
export type IgnoreLabel = (typeof IGNORE_LABELS)[number];

/** Series left out of every Synthetics query, by label. An empty list ignores nothing. */
export type SyntheticsScope = Record<IgnoreLabel, string[]>;

/** Labels whose ignore list is non-empty. */
export function ignoredLabels(scope: SyntheticsScope): IgnoreLabel[] {
  return IGNORE_LABELS.filter((label) => scope[label].length > 0);
}

export function hasIgnores(scope: SyntheticsScope): boolean {
  return ignoredLabels(scope).length > 0;
}

// "Seen recently" lookback matching the shared data probes.
const SM_LOOKBACK = '24h';

// Negative regex matchers for the ignore lists; a series missing the label is kept, so an absent
// label degrades a list to a no-op. '' when nothing is ignored so metrics stay bare.
function ignoreSelector(scope: SyntheticsScope | null): string {
  const matchers = scope ? ignoredLabels(scope).map((label) => `${label}!~${quotePromAlternation(scope[label])}`) : [];
  return matchers.length > 0 ? `{${matchers.join(',')}}` : '';
}

// A check = one (job, instance) pair; sm_check_info has one series per probe location.
const checkCountQuery = (sel: string) =>
  `count(count by (job, instance) (last_over_time(sm_check_info${sel}[${SM_LOOKBACK}])))`;

// Detection stays unscoped: a filter must never change which datasource the card resolves.
const SM_CHECK_PROBE = checkCountQuery('');

// Success ratio below this over the last hour puts a check in the attention group. The 1h
// window keeps the alert about current breakage; the stats secondary deliberately reports
// the 24h fleet ratio instead, matching its "% success · 24h" copy.
const SM_ATTENTION_RATIO = 0.9;

// Probe success ratio over `window`, fleet-wide or per `by` labels.
function successRatioExpr(sel: string, window: string, by?: string): string {
  const sum = by ? `sum by (${by}) ` : 'sum';
  return `${sum}(rate(probe_all_success_sum${sel}[${window}])) / ${sum}(rate(probe_all_success_count${sel}[${window}]))`;
}

function statsQueries(scope: SyntheticsScope | null): Record<string, string> {
  const sel = ignoreSelector(scope);
  return {
    // `or vector(0)` turns an empty fleet into a 0 sample; a missing sample then means the count
    // query failed, which the partial batch would otherwise make indistinguishable from empty.
    checks: `${checkCountQuery(sel)} or vector(0)`,
    successRatio: successRatioExpr(sel, SM_LOOKBACK),
  };
}

function healthQueries(scope: SyntheticsScope | null): Record<string, string> {
  const perCheck = successRatioExpr(ignoreSelector(scope), '1h', 'job, instance');
  return {
    failing: `count((${perCheck}) < ${SM_ATTENTION_RATIO})`,
    worst: `bottomk(1, (${perCheck}) < ${SM_ATTENTION_RATIO})`,
  };
}

// Single attempt inside the probe timeout; errors read as no data in the parallel scan.
async function hasSyntheticChecks(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  signal?: AbortSignal
): Promise<boolean> {
  const frames = await runInstantQueries({ checks: SM_CHECK_PROBE }, ds, { timeoutMs: PROBE_TIMEOUT_MS, signal });
  return (readScalar(frames, 'checks') ?? 0) > 0;
}

/** Resolved Prometheus datasource with Synthetic Monitoring data, or null when none. */
export function probeSyntheticChecks(): Promise<DataSourceInstanceListItem | null> {
  return probeFound('prometheus', hasSyntheticChecks, CLOUD_UTILITY_PROM_DATASOURCE_UIDS);
}

/** Check count and fleet success ratio over the stats lookback; `scope` null = every check. */
export async function fetchSyntheticsStats(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: SyntheticsScope | null
): Promise<SyntheticsStats> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(statsQueries(scope), ds, { partial: true });
  return {
    checks: readScalar(frames, 'checks'),
    successRatio: readScalar(frames, 'successRatio'),
  };
}

/** Failing-check count and the worst offender over the last hour; `scope` null = every check. Empty vectors read as null. */
export async function fetchSyntheticsHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: SyntheticsScope | null
): Promise<SyntheticsHealth> {
  // partial: readers are null-safe; one failed query keeps the rest.
  const frames = await runInstantQueries(healthQueries(scope), ds, { partial: true });
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

/** Fleet success ratio over 24h; null when the probe metrics are absent. `scope` null = every check. */
export async function fetchSyntheticsSuccessSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: SyntheticsScope | null
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'success',
    // [1h] rate window: check cadence is configurable up to one run per hour and rate() needs
    // two samples in the window; [5m] would blank the trend for slow fleets.
    successRatioExpr(ignoreSelector(scope), '1h'),
    24,
    ds
  );
  return readSeries(frames, 'success');
}
