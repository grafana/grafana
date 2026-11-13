import { type TimeRange } from '@grafana/data';
import { type DataSourceRef } from '@grafana/schema';

/** Grafana Cloud usage metrics: the same series the Insights charts use. */
export const USAGE_DATA_SOURCE: DataSourceRef = { type: 'prometheus', uid: 'grafanacloud-usage' };

/** About this many points per sparkline, whatever the range. */
const USAGE_POINTS = 60;

export const USAGE_SERIES_KEYS = [
  'activeRules',
  'pausedRules',
  'firing',
  'pending',
  'evaluations',
  'failures',
] as const;
export type UsageSeriesKey = (typeof USAGE_SERIES_KEYS)[number];

export interface UsageHistory {
  activeRules: number[];
  pausedRules: number[];
  firing: number[];
  pending: number[];
  /** Share of successful evaluations at each point, as a percentage. */
  successRate: number[];
  /** Evaluations over the whole range; undefined when the stack has no evaluation series. */
  evaluations?: { succeeded: number; failed: number };
}

export function buildUsageQueries(instanceId?: string): Record<UsageSeriesKey, string> {
  const matchers = (...extra: string[]) => {
    const all = instanceId ? [...extra, `id="${instanceId}"`] : extra;
    return all.length ? `{${all.join(', ')}}` : '';
  };

  return {
    activeRules: `sum(grafanacloud_grafana_instance_alerting_rule_group_rules${matchers('state="active"')})`,
    pausedRules: `sum(grafanacloud_grafana_instance_alerting_rule_group_rules${matchers('state="paused"')})`,
    firing: `sum(grafanacloud_grafana_instance_alerting_alerts${matchers('state="alerting"')})`,
    pending: `sum(grafanacloud_grafana_instance_alerting_alerts${matchers('state="pending"')})`,
    evaluations: `sum(grafanacloud_grafana_instance_alerting_rule_evaluations_total:rate5m${matchers()})`,
    failures: `sum(grafanacloud_grafana_instance_alerting_rule_evaluation_failures_total:rate5m${matchers()})`,
  };
}

export function getUsageStepSeconds(range: TimeRange): number {
  const seconds = (range.to.valueOf() - range.from.valueOf()) / 1000;
  return Math.max(60, Math.round(seconds / USAGE_POINTS));
}

/**
 * Evaluation series are per-second rates, so a step's evaluations are its rate times the step
 * length. Points with no evaluations are left out of the success rate rather than read as failures.
 */
export function summarizeUsageHistory(
  series: Partial<Record<UsageSeriesKey, number[]>>,
  stepSeconds: number
): UsageHistory {
  const evaluations = series.evaluations ?? [];
  const failures = series.failures ?? [];

  const successRate: number[] = [];
  let total = 0;
  let failed = 0;
  evaluations.forEach((rate, index) => {
    const failedRate = failures[index] ?? 0;
    total += rate * stepSeconds;
    failed += failedRate * stepSeconds;
    if (rate > 0) {
      successRate.push(((rate - failedRate) / rate) * 100);
    }
  });

  return {
    activeRules: series.activeRules ?? [],
    pausedRules: series.pausedRules ?? [],
    firing: series.firing ?? [],
    pending: series.pending ?? [],
    successRate,
    evaluations: evaluations.length ? { succeeded: Math.round(total - failed), failed: Math.round(failed) } : undefined,
  };
}
