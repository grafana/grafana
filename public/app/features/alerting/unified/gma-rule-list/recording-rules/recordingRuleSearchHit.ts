import * as z from 'zod';

import { type RecordingRuleRecordingRuleHealth } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { labels, optionalBoolean, optionalString, stringArray } from '../rule-search/searchHitFields';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  interval?: string;
  metric?: string;
  targetDataSourceUid?: string;
  /** Absent until `alerting.ruleStatusSync` populates it; `Recording` means healthy. */
  health?: RecordingRuleRecordingRuleHealth;
  lastError?: string;
  labels: Record<string, string>;
  dataSourceUids: string[];
}

// Keyed by the generated union, so a value the API adds or drops fails the type check here.
const RECORDING_RULE_HEALTHS = {
  Unknown: 'Unknown',
  Recording: 'Recording',
  Paused: 'Paused',
  Error: 'Error',
  NoData: 'NoData',
} satisfies Record<RecordingRuleRecordingRuleHealth, RecordingRuleRecordingRuleHealth>;

const recordingRuleSearchFieldsSchema = z.object({
  title: optionalString,
  folder: optionalString,
  paused: optionalBoolean,
  interval: optionalString,
  metric: optionalString,
  targetDatasourceUID: optionalString,
  health: z.enum(RECORDING_RULE_HEALTHS).optional().catch(undefined),
  lastError: optionalString,
  labels,
  datasourceUIDs: stringArray,
});

/** Parses one search item straight into the row's shape. */
export const recordingRuleSearchHitSchema = z
  .object({
    resource: z.object({ name: z.string() }),
    fields: recordingRuleSearchFieldsSchema.catch(() => recordingRuleSearchFieldsSchema.parse({})),
  })
  .transform(
    ({ resource, fields }): RecordingRuleSearchHit => ({
      uid: resource.name,
      title: fields.title ?? resource.name,
      folderUid: fields.folder,
      paused: fields.paused,
      interval: fields.interval,
      metric: fields.metric,
      targetDataSourceUid: fields.targetDatasourceUID,
      health: fields.health,
      lastError: fields.lastError,
      labels: fields.labels,
      dataSourceUids: fields.datasourceUIDs,
    })
  );
