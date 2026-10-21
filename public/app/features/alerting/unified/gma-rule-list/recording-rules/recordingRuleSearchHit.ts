import {
  type ListRecordingRuleSearchRulesV0Alpha1SearchResultHit,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { asBoolean, asOneOf, asString } from '../rule-search/searchHitFields';
import { keysOf } from '../shared/keysOf';

export interface RecordingRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  health?: RecordingRuleRecordingRuleHealth;
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
    health: asOneOf(fields.health, RECORDING_RULE_HEALTHS),
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
