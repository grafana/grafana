import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type ListAlertRuleSearchRulesV0Alpha1SearchResultHit,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { asBoolean, asOneOf, asString } from '../rule-search/searchHitFields';
import { keysOf } from '../shared/keysOf';

export interface AlertRuleSearchHit {
  uid: string;
  title: string;
  folderUid?: string;
  paused?: boolean;
  /** Absent until `alerting.ruleStatusSync` populates it; absence reads as Unavailable. */
  state?: AlertRuleAlertRuleState;
  health?: AlertRuleAlertRuleHealth;
}

export function toAlertRuleSearchHit(item: ListAlertRuleSearchRulesV0Alpha1SearchResultHit): AlertRuleSearchHit {
  const fields: Record<string, unknown> = item.fields ?? {};

  return {
    uid: item.resource.name,
    title: asString(fields.title) ?? item.resource.name,
    folderUid: asString(fields.folder),
    paused: asBoolean(fields.paused),
    state: asOneOf(fields.state, ALERT_RULE_STATES),
    health: asOneOf(fields.health, ALERT_RULE_HEALTHS),
  };
}

// Keyed by the generated unions, so a value the API adds or drops fails the type check here.
const ALERT_RULE_STATES = keysOf<AlertRuleAlertRuleState>({
  Inactive: true,
  Healthy: true,
  Firing: true,
  Pending: true,
  Recovering: true,
});

const ALERT_RULE_HEALTHS = keysOf<AlertRuleAlertRuleHealth>({
  Unknown: true,
  OK: true,
  Paused: true,
  Error: true,
  NoData: true,
});
