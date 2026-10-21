import {
  type ListRecordingRuleSearchRulesV0Alpha1SearchResultHit,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { asBoolean, asLabels, asOneOf, asString, asStringArray } from '../rule-search/searchHitFields';
import { keysOf } from '../shared/keysOf';

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

export function toRecordingRuleSearchHit(
  item: ListRecordingRuleSearchRulesV0Alpha1SearchResultHit
): RecordingRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};

  return {
    uid: item.resource.name,
    title: asString(fields.title) ?? item.resource.name,
    folderUid: asString(fields.folder),
    paused: asBoolean(fields.paused),
    interval: asString(fields.interval),
    metric: asString(fields.metric),
    targetDataSourceUid: asString(fields.targetDatasourceUID),
    health: asOneOf(fields.health, RECORDING_RULE_HEALTHS),
    lastError: asString(fields.lastError),
    labels: asLabels(fields.labels),
    dataSourceUids: asStringArray(fields.datasourceUIDs),
  };
}

// Keyed by the generated union, so a value the API adds or drops fails the type check here.
const RECORDING_RULE_HEALTHS = keysOf<RecordingRuleRecordingRuleHealth>({
  Unknown: true,
  Recording: true,
  Paused: true,
  Error: true,
  NoData: true,
});
