import { type RuleSearchResultItem } from '../rule-search/searchQueryLeaves';

/**
 * The per-row shape read out of an Alert rule search hit. Kept separate from the raw
 * `fields` bag (typed `any`) so row code never touches that bag directly, and so growing the
 * projected field set later only changes this one place.
 */
export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Persisted evaluation state/health - absent unless `alerting.ruleStatusSync` has populated
   * it. Absence must read as Unavailable, never a healthy default. */
  state?: string;
  health?: string;
  lastError?: string;
  /** Falls back to this when there's no lastError. */
  summary?: string;
  labels: Record<string, string>;
  dataSourceUids: string[];
  notificationType?: string;
  receiver?: string;
  routingTree?: string;
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'string') {
      result[key] = v;
    }
  }
  return result;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Labels are indexed (and so returned) as `key=value` strings, not an object - see the
 * `In: ["key=value"]` filter shape in searchQueryLeaves.ts. Falls back to object form defensively. */
function asLabels(value: unknown): Record<string, string> {
  if (Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const entry of value) {
      if (typeof entry !== 'string') {
        continue;
      }
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        result[entry] = '';
      } else {
        result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
      }
    }
    return result;
  }
  return asRecord(value);
}

export function toAlertRuleSearchHit(item: RuleSearchResultItem): AlertRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};
  const annotations = asRecord(fields.annotations);

  return {
    uid: item.resource.name,
    title: typeof fields.title === 'string' ? fields.title : item.resource.name,
    folderUid: typeof fields.folder === 'string' ? fields.folder : undefined,
    paused: typeof fields.paused === 'boolean' ? fields.paused : undefined,
    state: typeof fields.state === 'string' ? fields.state : undefined,
    health: typeof fields.health === 'string' ? fields.health : undefined,
    lastError: typeof fields.lastError === 'string' ? fields.lastError : undefined,
    summary: annotations.summary,
    labels: asLabels(fields.labels),
    dataSourceUids: asStringArray(fields.datasourceUIDs),
    notificationType: typeof fields.notificationType === 'string' ? fields.notificationType : undefined,
    receiver: typeof fields.receiver === 'string' ? fields.receiver : undefined,
    routingTree: typeof fields.routingTree === 'string' ? fields.routingTree : undefined,
  };
}
