import { cloneDeep } from 'lodash';

import { RuleWithLocation } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { generateCopiedName } from '../utils/duplicate';
import { getRuleName, isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from '../utils/rules';

export function changeRuleName(rule: RulerRuleDTO, newName: string) {
  if (isGrafanaRulerRule(rule)) {
    rule.grafana_alert.title = newName;
  }
  if (isAlertingRulerRule(rule)) {
    rule.alert = newName;
  }

  if (isRecordingRulerRule(rule)) {
    rule.record = newName;
  }
}

export function cloneRuleDefinition(rule: RuleWithLocation<RulerRuleDTO>) {
  const ruleClone = cloneDeep(rule);
  changeRuleName(
    ruleClone.rule,
    generateCopiedName(getRuleName(ruleClone.rule), ruleClone.group.rules.map(getRuleName))
  );

  if (isGrafanaRulerRule(ruleClone.rule)) {
    ruleClone.rule.grafana_alert.uid = '';

    // Provisioned alert rules have provisioned alert group which cannot be used in UI
    if (Boolean(ruleClone.rule.grafana_alert.provenance)) {
      ruleClone.group = { name: '', rules: ruleClone.group.rules };
    }
  }

  return ruleClone;
}
