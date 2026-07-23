import { type DataFrame } from '@grafana/data';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { FIELD_NAMES } from '../constants';

import { normalizeFrame } from './dataTransform';

type AlertState = PromAlertingRuleState.Firing | PromAlertingRuleState.Pending;

export function countRules(ruleFrame: DataFrame) {
  const ruleUIDField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.grafanaRuleUID);
  const alertstateField = ruleFrame.fields.find((f) => f.name === FIELD_NAMES.alertstate);

  if (!ruleUIDField || !alertstateField) {
    return { firing: 0, pending: 0 };
  }

  const counts = {
    [PromAlertingRuleState.Firing]: new Set<string>(),
    [PromAlertingRuleState.Pending]: new Set<string>(),
  };

  ruleUIDField.values.forEach((ruleUID: string, i: number) => {
    const alertstate: AlertState = alertstateField.values[i];
    counts[alertstate]?.add(ruleUID);
  });

  return {
    firing: counts[PromAlertingRuleState.Firing].size,
    pending: counts[PromAlertingRuleState.Pending].size,
  };
}

export function countInstances(instanceFrame: DataFrame) {
  const frame = normalizeFrame(instanceFrame);
  const alertstateField = frame.fields.find((f) => f.name === FIELD_NAMES.alertstate);
  const valueField = frame.fields.find((f) => f.name === FIELD_NAMES.value);

  if (!alertstateField || !valueField) {
    return { firing: 0, pending: 0 };
  }

  const getValue = (state: AlertState) => {
    const index = alertstateField.values.findIndex((s: string) => s === state);
    return valueField.values[index] ?? 0;
  };
  return { firing: getValue(PromAlertingRuleState.Firing), pending: getValue(PromAlertingRuleState.Pending) };
}
