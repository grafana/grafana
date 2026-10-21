import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type ListAlertRuleSearchRulesV0Alpha1SearchResultHit,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type InstanceTotals } from '../rule-row/InstanceTotalsMeta';
import { asBoolean, asLabels, asOneOf, asString, asStringArray } from '../rule-search/searchHitFields';
import { keysOf } from '../shared/keysOf';

export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  interval?: string;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  state?: AlertRuleAlertRuleState;
  health?: AlertRuleAlertRuleHealth;
  lastError?: string;
  totals: InstanceTotals;
  /** Falls back to this when there's no lastError. */
  summary?: string;
  labels: Record<string, string>;
  dataSourceUids: string[];
  notificationType?: string;
  receiver?: string;
  routingTree?: string;
}

export function toAlertRuleSearchHit(item: ListAlertRuleSearchRulesV0Alpha1SearchResultHit): AlertRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};
  const annotations = asAnnotations(fields.annotations);

  return {
    uid: item.resource.name,
    title: asString(fields.title) ?? item.resource.name,
    folderUid: asString(fields.folder),
    paused: asBoolean(fields.paused),
    interval: asString(fields.interval),
    state: asOneOf(fields.state, ALERT_RULE_STATES),
    health: asOneOf(fields.health, ALERT_RULE_HEALTHS),
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

/** Indexed as one JSON-encoded object string. */
function asAnnotations(value: unknown): Record<string, string> {
  if (typeof value !== 'string') {
    return {};
  }
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
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

// Keyed by the generated unions, so a value the API adds or drops fails the type check here.
const ALERT_RULE_STATES = keysOf<AlertRuleAlertRuleState>({
  Inactive: true,
  Healthy: true,
  Firing: true,
  Pending: true,
  Recovering: true,
});

const ALERT_RULE_HEALTHS = keysOf<AlertRuleAlertRuleHealth>({
  Unknown: true,
  OK: true,
  Paused: true,
  Error: true,
  NoData: true,
});
