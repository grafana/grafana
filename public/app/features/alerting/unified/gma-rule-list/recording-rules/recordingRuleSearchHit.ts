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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Labels are indexed (and so returned) as `key=value` strings, not an object - see the
 * `In: ["key=value"]` filter shape in searchQueryLeaves.ts. */
function asLabels(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of asStringArray(value)) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      result[entry] = '';
    } else {
      result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
    }
  }
  return result;
}

export function toRecordingRuleSearchHit(item: RuleSearchResultItem): RecordingRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};

  return {
    uid: item.resource.name,
    title: typeof fields.title === 'string' ? fields.title : item.resource.name,
    folderUid: typeof fields.folder === 'string' ? fields.folder : undefined,
    paused: typeof fields.paused === 'boolean' ? fields.paused : undefined,
    interval: typeof fields.interval === 'string' ? fields.interval : undefined,
    metric: typeof fields.metric === 'string' ? fields.metric : undefined,
    targetDataSourceUid: typeof fields.targetDatasourceUID === 'string' ? fields.targetDatasourceUID : undefined,
    health: typeof fields.health === 'string' ? fields.health : undefined,
    lastError: typeof fields.lastError === 'string' ? fields.lastError : undefined,
    labels: asLabels(fields.labels),
    dataSourceUids: asStringArray(fields.datasourceUIDs),
  };
}
