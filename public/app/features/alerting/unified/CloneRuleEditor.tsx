import { cloneDeep } from 'lodash';
import React from 'react';
import { useAsync } from 'react-use';

import { locationService } from '@grafana/runtime/src';
import { Alert, LoadingPlaceholder } from '@grafana/ui/src';

import { useDispatch } from '../../../types';
import { RuleIdentifier, RuleWithLocation } from '../../../types/unified-alerting';
import { RulerRuleDTO } from '../../../types/unified-alerting-dto';

import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { fetchEditableRuleAction } from './state/actions';
import { rulerRuleToFormValues } from './utils/rule-form';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './utils/rules';
import { createUrl } from './utils/url';

export function CloneRuleEditor({ sourceRuleId }: { sourceRuleId: RuleIdentifier }) {
  const dispatch = useDispatch();

  const {
    loading,
    value: rule,
    error,
  } = useAsync(() => dispatch(fetchEditableRuleAction(sourceRuleId)).unwrap(), [sourceRuleId]);

  if (loading) {
    return <LoadingPlaceholder text="Loading the rule" />;
  }

  if (rule) {
    const ruleClone = cloneDeep(rule);
    changeRuleName(ruleClone.rule, generateCopiedRuleTitle(ruleClone));

    return <AlertRuleForm prefill={rulerRuleToFormValues(ruleClone)} />;
  }

  if (error) {
    return (
      <Alert title="Error" severity="error">
        {error.message}
      </Alert>
    );
  }

  return (
    <Alert
      title="Cannot duplicate. The rule does not exist"
      buttonContent="Go back to alert list"
      onRemove={() => locationService.replace(createUrl('/alerting/list'))}
    />
  );
}

function generateCopiedRuleTitle(originRuleWithLocation: RuleWithLocation): string {
  const originName = getRuleName(originRuleWithLocation.rule);
  const existingRulesNames = originRuleWithLocation.group.rules.map(getRuleName);

  let newName = `${originName} (Copied)`;

  for (let i = 1; existingRulesNames.includes(newName); i++) {
    newName = `${originName} (Copied ${i})`;
  }

  return newName;
}

function getRuleName(rule: RulerRuleDTO) {
  if (isGrafanaRulerRule(rule)) {
    return rule.grafana_alert.title;
  }
  if (isAlertingRulerRule(rule)) {
    return rule.alert;
  }

  if (isRecordingRulerRule(rule)) {
    return rule.record;
  }

  return '';
}

function changeRuleName(rule: RulerRuleDTO, newName: string) {
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
