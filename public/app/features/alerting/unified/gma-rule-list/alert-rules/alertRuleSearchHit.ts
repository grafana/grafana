import * as z from 'zod';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type Labels } from 'app/types/unified-alerting-dto';

import { isPrivateLabelKey } from '../../utils/labels';

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
  /** Per-state instance counts; absent when alerting.ruleStatusSync is off or not yet synced. */
  totalsHealthy?: number;
  totalsFiring?: number;
  totalsPending?: number;
  totalsRecovering?: number;
  totalsNoData?: number;
  totalsError?: number;
  /** Routing type; absent when the rule has no notification settings. */
  notificationType?: 'SimplifiedRouting' | 'NamedRoutingTree';
  /** Contact point name for SimplifiedRouting. */
  receiver?: string;
  /** Named policy for NamedRoutingTree; absent means the default policy. */
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

// annotations comes back as a JSON-encoded string; parse it safely via Zod.
const annotationsSchema = z.record(z.string(), z.string());

function tryParseAnnotations(s: string): Record<string, string> | undefined {
  try {
    return annotationsSchema.parse(JSON.parse(s));
  } catch {
    return undefined;
  }
}

/**
 * Converts the search API's flat label strings ("key" and "key=value") into a Labels object.
 * Ignores key-only entries (used for filter matching) and private label keys.
 * Exported for reuse in recordingRuleSearchHit.ts.
 */
export function parseSearchLabels(entries?: string[]): Labels | undefined {
  if (entries === undefined || entries.length === 0) {
    return undefined;
  }
  const result: Labels = {};
  for (const entry of entries) {
    const indexPosition = entry.indexOf('=');
    if (indexPosition > 0) {
      const key = entry.slice(0, indexPosition);
      if (!isPrivateLabelKey(key)) {
        result[key] = entry.slice(indexPosition + 1);
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
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
  totalsHealthy: z.number().optional().catch(undefined),
  totalsFiring: z.number().optional().catch(undefined),
  totalsPending: z.number().optional().catch(undefined),
  totalsRecovering: z.number().optional().catch(undefined),
  totalsNoData: z.number().optional().catch(undefined),
  totalsError: z.number().optional().catch(undefined),
  notificationType: z.enum(['SimplifiedRouting', 'NamedRoutingTree']).optional().catch(undefined),
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
      totalsHealthy: fields.totalsHealthy,
      totalsFiring: fields.totalsFiring,
      totalsPending: fields.totalsPending,
      totalsRecovering: fields.totalsRecovering,
      totalsNoData: fields.totalsNoData,
      totalsError: fields.totalsError,
      notificationType: fields.notificationType,
      receiver: fields.receiver,
      routingTree: fields.routingTree,
    })
  );
