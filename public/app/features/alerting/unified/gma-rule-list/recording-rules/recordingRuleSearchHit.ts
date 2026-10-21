import { type ListRecordingRuleSearchRulesV0Alpha1SearchResultHit } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { asBoolean, asLabels, asString, asStringArray } from '../rule-search/searchHitFields';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  interval?: string;
  metric?: string;
  targetDataSourceUid?: string;
  /** Absent until `alerting.ruleStatusSync` populates it; `Recording` means healthy. */
  health?: string;
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
    health: asString(fields.health),
    lastError: asString(fields.lastError),
    labels: asLabels(fields.labels),
    dataSourceUids: asStringArray(fields.datasourceUIDs),
  };
}
