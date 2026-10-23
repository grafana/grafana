import * as z from 'zod';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type InstanceTotals } from '../rule-row/InstanceTotalsMeta';
import { labels, optionalBoolean, optionalCount, optionalString, stringArray } from '../rule-search/searchHitFields';

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

// Keyed by the generated unions, so a value the API adds or drops fails the type check here.
const ALERT_RULE_STATES = {
  Inactive: 'Inactive',
  Healthy: 'Healthy',
  Firing: 'Firing',
  Pending: 'Pending',
  Recovering: 'Recovering',
} satisfies Record<AlertRuleAlertRuleState, AlertRuleAlertRuleState>;

const ALERT_RULE_HEALTHS = {
  Unknown: 'Unknown',
  OK: 'OK',
  Paused: 'Paused',
  Error: 'Error',
  NoData: 'NoData',
} satisfies Record<AlertRuleAlertRuleHealth, AlertRuleAlertRuleHealth>;

/** Indexed as one JSON-encoded object string; only the string values are kept. */
const annotationsSchema = z.string().transform((value): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(value);
    const annotations: Record<string, string> = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          annotations[key] = v;
        }
      }
    }
    return annotations;
  } catch {
    return {};
  }
});

const alertRuleSearchFieldsSchema = z.object({
  title: optionalString,
  folder: optionalString,
  paused: optionalBoolean,
  interval: optionalString,
  state: z.enum(ALERT_RULE_STATES).optional().catch(undefined),
  health: z.enum(ALERT_RULE_HEALTHS).optional().catch(undefined),
  lastError: optionalString,
  totalsHealthy: optionalCount,
  totalsFiring: optionalCount,
  totalsPending: optionalCount,
  totalsRecovering: optionalCount,
  totalsNoData: optionalCount,
  totalsError: optionalCount,
  annotations: annotationsSchema.catch({}),
  labels,
  datasourceUIDs: stringArray,
  notificationType: optionalString,
  receiver: optionalString,
  routingTree: optionalString,
});

/** Parses one search item straight into the row's shape. */
export const alertRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: alertRuleSearchFieldsSchema.catch(() => alertRuleSearchFieldsSchema.parse({})),
  })
  .transform(
    ({ resource, fields }): AlertRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      interval: fields.interval,
      state: fields.state,
      health: fields.health,
      lastError: fields.lastError,
      totals: {
        healthy: fields.totalsHealthy,
        firing: fields.totalsFiring,
        pending: fields.totalsPending,
        recovering: fields.totalsRecovering,
        noData: fields.totalsNoData,
        error: fields.totalsError,
      },
      summary: fields.annotations.summary,
      labels: fields.labels,
      dataSourceUids: fields.datasourceUIDs,
      notificationType: fields.notificationType,
      receiver: fields.receiver,
      routingTree: fields.routingTree,
    })
  );
