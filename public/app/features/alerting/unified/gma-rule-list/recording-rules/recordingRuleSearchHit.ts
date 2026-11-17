import * as z from 'zod/mini';

import { type RecordingRuleRecordingRuleHealth } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type Labels } from 'app/types/unified-alerting-dto';

import { parseSearchLabels } from '../alert-rules/alertRuleSearchHit';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  health?: RecordingRuleRecordingRuleHealth;
  /** Absent until `alerting.ruleStatusSync` populates it. */
  lastError?: string;
  /** Evaluation interval, e.g. "1m". */
  interval?: string;
  /** Rule labels with private keys excluded; absent when none remain. */
  labels?: Labels;
  /** UIDs of data sources queried by the rule's expressions. */
  datasourceUIDs?: string[];
  /** The name of the recorded metric. */
  metric?: string;
  /** UID of the datasource the metric is written to. */
  targetDatasourceUID?: string;
}

// Keyed by the generated union, so a value the API adds or drops fails the type check here.
const RECORDING_RULE_HEALTHS = {
  Unknown: 'Unknown',
  Recording: 'Recording',
  Paused: 'Paused',
  Error: 'Error',
  NoData: 'NoData',
} satisfies Record<RecordingRuleRecordingRuleHealth, RecordingRuleRecordingRuleHealth>;

// Search fields are untyped in the API. A field that is missing or fails its check reads as absent
// instead of failing the whole hit.
const recordingRuleSearchFieldsSchema = z.object({
  title: z.catch(z.optional(z.string()), undefined),
  folder: z.catch(z.optional(z.string()), undefined),
  paused: z.catch(z.optional(z.boolean()), undefined),
  health: z.catch(z.optional(z.enum(RECORDING_RULE_HEALTHS)), undefined),
  lastError: z.catch(z.optional(z.string()), undefined),
  interval: z.catch(z.optional(z.string()), undefined),
  labels: z.catch(z.optional(z.array(z.string())), undefined),
  datasourceUIDs: z.catch(z.optional(z.array(z.string())), undefined),
  metric: z.catch(z.optional(z.string()), undefined),
  targetDatasourceUID: z.catch(z.optional(z.string()), undefined),
});

/** Parses one search item straight into the row's shape. */
export const recordingRuleSearchHitSchema = z.pipe(
  z.object({
    resource: z.object({ name: z.string() }),
    fields: z.catch(recordingRuleSearchFieldsSchema, {}),
  }),
  z.transform(
    ({ resource, fields }): RecordingRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      health: fields.health,
      lastError: fields.lastError,
      interval: fields.interval,
      labels: parseSearchLabels(fields.labels),
      datasourceUIDs: fields.datasourceUIDs,
      metric: fields.metric,
      targetDatasourceUID: fields.targetDatasourceUID,
    })
  )
);
