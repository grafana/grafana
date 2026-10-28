import * as z from 'zod';

import { type RecordingRuleRecordingRuleHealth } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

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
  title: z.string().optional().catch(undefined),
  folder: z.string().optional().catch(undefined),
  paused: z.boolean().optional().catch(undefined),
  health: z.enum(RECORDING_RULE_HEALTHS).optional().catch(undefined),
  lastError: z.string().optional().catch(undefined),
  // annotations is requested but not mapped: recording rules have no summary concept.
  interval: z.string().optional().catch(undefined),
});

/** Parses one search item straight into the row's shape. */
export const recordingRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: recordingRuleSearchFieldsSchema.catch({}),
  })
  .transform(
    ({ resource, fields }): RecordingRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      health: fields.health,
      lastError: fields.lastError,
      interval: fields.interval,
    })
  );
