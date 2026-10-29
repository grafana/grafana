import * as z from 'zod';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type AlertRuleNotificationSettingsType,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type Labels } from 'app/types/unified-alerting-dto';

import { type InstanceTotals } from '../rule-row/InstanceTotalsMeta';
import { findOriginLabel, parseSearchLabels } from '../rule-search/searchHitLabels';

export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  state?: AlertRuleAlertRuleState;
  health?: AlertRuleAlertRuleHealth;
  /** Absent until `alerting.ruleStatusSync` populates it. */
  lastError?: string;
  /** From the rule's `summary` annotation; absent when the annotation is missing. */
  summary?: string;
  /** Evaluation interval, e.g. "1m". */
  interval?: string;
  /** Rule labels with private keys excluded; absent when none remain. */
  labels?: Labels;
  /** UIDs of data sources queried by the rule's expressions. */
  datasourceUIDs?: string[];
  /** The raw `__grafana_origin` label, which `labels` leaves out; the plugin badge reads it. */
  originLabel?: string;
  /** Per-state instance counts; absent when the search returned none. The syncer never writes a zero count. */
  totals?: InstanceTotals;
  notificationType?: AlertRuleNotificationSettingsType;
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

const NOTIFICATION_TYPES = {
  SimplifiedRouting: 'SimplifiedRouting',
  NamedRoutingTree: 'NamedRoutingTree',
} satisfies Record<AlertRuleNotificationSettingsType, AlertRuleNotificationSettingsType>;

const optionalCount = z.number().int().nonnegative().optional().catch(undefined);

function toInstanceTotals(fields: z.infer<typeof alertRuleSearchFieldsSchema>): InstanceTotals | undefined {
  const totals: InstanceTotals = {
    healthy: fields.totalsHealthy,
    firing: fields.totalsFiring,
    pending: fields.totalsPending,
    recovering: fields.totalsRecovering,
    noData: fields.totalsNoData,
    error: fields.totalsError,
  };
  return Object.values(totals).some((total) => total !== undefined) ? totals : undefined;
}

// annotations comes back as a JSON-encoded string; parse it safely via Zod.
const annotationsSchema = z.record(z.string(), z.string());

function tryParseAnnotations(s: string): Record<string, string> | undefined {
  try {
    return annotationsSchema.parse(JSON.parse(s));
  } catch {
    return undefined;
  }
}

// Search fields are untyped in the API. A field that is missing or fails its check reads as absent
// instead of failing the whole hit.
const alertRuleSearchFieldsSchema = z.object({
  title: z.string().optional().catch(undefined),
  folder: z.string().optional().catch(undefined),
  paused: z.boolean().optional().catch(undefined),
  state: z.enum(ALERT_RULE_STATES).optional().catch(undefined),
  health: z.enum(ALERT_RULE_HEALTHS).optional().catch(undefined),
  lastError: z.string().optional().catch(undefined),
  annotations: z.string().transform(tryParseAnnotations).optional().catch(undefined),
  interval: z.string().optional().catch(undefined),
  labels: z.array(z.string()).optional().catch(undefined),
  datasourceUIDs: z.array(z.string()).optional().catch(undefined),
  totalsHealthy: optionalCount,
  totalsFiring: optionalCount,
  totalsPending: optionalCount,
  totalsRecovering: optionalCount,
  totalsNoData: optionalCount,
  totalsError: optionalCount,
  notificationType: z.enum(NOTIFICATION_TYPES).optional().catch(undefined),
  receiver: z.string().optional().catch(undefined),
  routingTree: z.string().optional().catch(undefined),
});

/** Parses one search item straight into the row's shape. */
export const alertRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: alertRuleSearchFieldsSchema.catch({}),
  })
  .transform(
    ({ resource, fields }): AlertRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      state: fields.state,
      health: fields.health,
      lastError: fields.lastError,
      summary: fields.annotations?.summary,
      interval: fields.interval,
      labels: parseSearchLabels(fields.labels),
      datasourceUIDs: fields.datasourceUIDs,
      originLabel: findOriginLabel(fields.labels),
      totals: toInstanceTotals(fields),
      notificationType: fields.notificationType,
      receiver: fields.receiver,
      routingTree: fields.routingTree,
    })
  );
