import { type InstanceTotals } from '../rule-row/InstanceTotalsMeta';
import { asBoolean, asLabels, asString, asStringArray } from '../rule-search/searchHitFields';
import { type RuleSearchResultItem } from '../rule-search/searchQueryLeaves';

/**
 * The per-row shape read out of an Alert rule search hit. Kept separate from the raw
 * `fields` bag (typed `any`) so row code never touches that bag directly, and so growing the
 * projected field set later only changes this one place.
 */
export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** The rule's own evaluation interval, as a duration such as `1m`. */
  interval?: string;
  /** Persisted evaluation state/health - absent unless `alerting.ruleStatusSync` has populated
   * it. Absence must read as Unavailable, never a healthy default. */
  state?: string;
  health?: string;
  lastError?: string;
  /** Per-state instance counts; like state and health, absent without stored status. */
  totals: InstanceTotals;
  /** Falls back to this when there's no lastError. */
  summary?: string;
  labels: Record<string, string>;
  dataSourceUids: string[];
  notificationType?: string;
  receiver?: string;
  routingTree?: string;
}

export function toAlertRuleSearchHit(item: RuleSearchResultItem): AlertRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};
  const annotations = asRecord(fields.annotations);

  return {
    uid: item.resource.name,
    title: asString(fields.title) ?? item.resource.name,
    folderUid: asString(fields.folder),
    paused: asBoolean(fields.paused),
    interval: asString(fields.interval),
    state: asString(fields.state),
    health: asString(fields.health),
    lastError: asString(fields.lastError),
    totals: {
      healthy: asCount(fields.totalsHealthy),
      firing: asCount(fields.totalsFiring),
      pending: asCount(fields.totalsPending),
      recovering: asCount(fields.totalsRecovering),
      noData: asCount(fields.totalsNoData),
      error: asCount(fields.totalsError),
    },
    summary: annotations.summary,
    labels: asLabels(fields.labels),
    dataSourceUids: asStringArray(fields.datasourceUIDs),
    notificationType: asString(fields.notificationType),
    receiver: asString(fields.receiver),
    routingTree: asString(fields.routingTree),
  };
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string') {
      result[key] = v;
    }
  }
  return result;
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
