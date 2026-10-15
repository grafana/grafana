import { asBoolean, asLabels, asString, asStringArray } from '../rule-search/searchHitFields';
import { type RuleSearchResultItem } from '../rule-search/searchQueryLeaves';

/**
 * The per-row shape read out of a Recording rule search hit. Kept separate from the raw
 * `fields` bag so row code never touches that bag directly.
 */
export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** The rule's own evaluation interval, as a duration such as `1m`. */
  interval?: string;
  metric?: string;
  targetDataSourceUid?: string;
  /** Persisted health - absent unless `alerting.ruleStatusSync` has populated it. `Recording`
   * is the successful value, distinct from Alert health's `OK`. Absence reads as Unavailable. */
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
