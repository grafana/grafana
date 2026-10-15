import { asBoolean, asLabels, asString, asStringArray } from '../rule-search/searchHitFields';
import { type RuleSearchResultItem } from '../rule-search/searchQueryLeaves';

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

export function toRecordingRuleSearchHit(item: RuleSearchResultItem): RecordingRuleSearchHit {
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
