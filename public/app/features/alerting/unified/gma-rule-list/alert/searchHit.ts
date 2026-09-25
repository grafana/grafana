import { type ResultItem } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

/**
 * The minimal per-row shape read out of an `/alertrules/search` hit. Kept separate from the
 * raw `ResultItem.fields` bag (typed `Unstructured`/`any`) so row code never touches that
 * bag directly, and so growing the projected field set later only changes this one place.
 */
export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  state?: string;
  health?: string;
}

export function toAlertRuleSearchHit(item: ResultItem): AlertRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};

  return {
    uid: item.resource.name,
    title: typeof fields.title === 'string' ? fields.title : item.resource.name,
    folderUid: typeof fields.folder === 'string' ? fields.folder : undefined,
    paused: typeof fields.paused === 'boolean' ? fields.paused : undefined,
    state: typeof fields.state === 'string' ? fields.state : undefined,
    health: typeof fields.health === 'string' ? fields.health : undefined,
  };
}
