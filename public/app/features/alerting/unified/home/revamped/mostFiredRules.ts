import { type DataSourceRef } from '@grafana/schema';

import { type QuerySeries } from './dataSourceQuery';

/** The Loki data source Grafana Cloud writes alert state history to. */
export const STATE_HISTORY_DATA_SOURCE: DataSourceRef = { type: 'loki', uid: 'grafanacloud-alert-state-history' };

const MOST_FIRED_LIMIT = 5;
const FIRED = '{from="state-history"} | json | current = `Alerting`';

export interface MostFiredRule {
  uid: string;
  name: string;
  timesFired: number;
  trend: number[];
}

/** How often each rule fired over the range, as Insights counts it, for the top rules. */
export function buildMostFiredQuery(rangeSeconds: number, limit = MOST_FIRED_LIMIT): string {
  return `topk(${limit}, sum by (labels_alertname, ruleUID) (count_over_time(${FIRED} [${rangeSeconds}s])))`;
}

/** Firing transitions per step for the given rules, for the trend in each row. */
export function buildFiringTrendQuery(ruleUIDs: string[], stepSeconds: number): string {
  return `sum by (ruleUID) (count_over_time(${FIRED} | ruleUID =~ \`${ruleUIDs.join('|')}\` [${stepSeconds}s]))`;
}

export function combineMostFired(top: QuerySeries[], trends: QuerySeries[]): MostFiredRule[] {
  const trendByRule = new Map(trends.map((series) => [series.labels.ruleUID, series.values]));

  return top
    .map(({ labels, values }) => ({
      uid: labels.ruleUID,
      name: labels.labels_alertname ?? labels.ruleUID,
      timesFired: values.at(-1) ?? 0,
      trend: trendByRule.get(labels.ruleUID) ?? [],
    }))
    .filter((rule) => rule.uid)
    .sort((a, b) => b.timesFired - a.timesFired);
}

/**
 * Loki leaves out the steps with no matching entries, so a rule that fired once comes back as a single
 * point. This lays the values onto every step of the range, with zero where Loki returned nothing.
 */
export function fillSteps(
  { times, values }: Pick<QuerySeries, 'times' | 'values'>,
  fromMs: number,
  toMs: number,
  stepMs: number
): number[] {
  const steps = new Array(Math.floor((toMs - fromMs) / stepMs) + 1).fill(0);
  times.forEach((time, index) => {
    const step = Math.floor((time - fromMs) / stepMs);
    if (step >= 0 && step < steps.length) {
      steps[step] += values[index];
    }
  });
  return steps;
}

interface HistoryFrame {
  data?: { values: unknown[][] };
}

interface HistoryLine {
  ruleUID?: string;
  ruleTitle?: string;
  current?: string;
}

function isHistoryLine(value: unknown): value is HistoryLine {
  return typeof value === 'object' && value !== null;
}

/**
 * Self-hosted stacks without the Cloud data source: counts the transitions into Alerting that the
 * state history API returned, per rule, with a trend over the range. The API caps how many events it
 * returns, so `capped` says when the counts cover only the latest events.
 */
export function countFiringFromHistory(
  frame: HistoryFrame,
  { fromMs, toMs, stepMs, limit }: { fromMs: number; toMs: number; stepMs: number; limit: number }
): { rules: MostFiredRule[]; capped: boolean } {
  const [times = [], lines = []] = frame.data?.values ?? [];
  const byRule = new Map<string, { name: string; times: number[] }>();

  lines.forEach((line, index) => {
    if (!isHistoryLine(line) || !line.ruleUID || !line.current?.startsWith('Alerting')) {
      return;
    }
    const rule = byRule.get(line.ruleUID) ?? { name: line.ruleTitle ?? line.ruleUID, times: [] };
    rule.times.push(Number(times[index]));
    byRule.set(line.ruleUID, rule);
  });

  const rules = [...byRule.entries()]
    .map(([uid, rule]) => ({
      uid,
      name: rule.name,
      timesFired: rule.times.length,
      trend: fillSteps({ times: rule.times, values: rule.times.map(() => 1) }, fromMs, toMs, stepMs),
    }))
    .sort((a, b) => b.timesFired - a.timesFired)
    .slice(0, MOST_FIRED_LIMIT);

  return { rules, capped: lines.length >= limit };
}
