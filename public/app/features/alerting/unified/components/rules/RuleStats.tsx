import pluralize from 'pluralize';
import React, { FC, Fragment, useMemo } from 'react';

import { CombinedRule, CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { isAlertingRule, isRecordingRule, isRecordingRulerRule } from '../../utils/rules';
import { StateColoredText } from '../StateColoredText';

interface Props {
  showInactive?: boolean;
  showRecording?: boolean;
  group?: CombinedRuleGroup;
  namespaces?: CombinedRuleNamespace[];
}

const emptyStats = {
  total: 0,
  recording: 0,
  [PromAlertingRuleState.Firing]: 0,
  [PromAlertingRuleState.Pending]: 0,
  [PromAlertingRuleState.Inactive]: 0,
  error: 0,
} as const;

export const RuleStats: FC<Props> = ({ showInactive, showRecording, group, namespaces }) => {
  const calculated = useMemo(() => {
    const stats = { ...emptyStats };
    const calcRule = (rule: CombinedRule) => {
      if (rule.promRule && isAlertingRule(rule.promRule)) {
        stats[rule.promRule.state] += 1;
      }
      if (rule.promRule?.health === 'err' || rule.promRule?.health === 'error') {
        stats.error += 1;
      }
      if (
        (rule.promRule && isRecordingRule(rule.promRule)) ||
        (rule.rulerRule && isRecordingRulerRule(rule.rulerRule))
      ) {
        stats.recording += 1;
      }
      stats.total += 1;
    };
    if (group) {
      group.rules.forEach(calcRule);
    }
    if (namespaces) {
      namespaces.forEach((namespace) => namespace.groups.forEach((group) => group.rules.forEach(calcRule)));
    }
    return stats;
  }, [group, namespaces]);

  const statsComponents: React.ReactNode[] = [];
  if (calculated[PromAlertingRuleState.Firing]) {
    statsComponents.push(
      <StateColoredText key="firing" status={PromAlertingRuleState.Firing}>
        {calculated[PromAlertingRuleState.Firing]} firing
      </StateColoredText>
    );
  }
  if (calculated.error) {
    statsComponents.push(
      <StateColoredText key="errors" status={PromAlertingRuleState.Firing}>
        {calculated.error} errors
      </StateColoredText>
    );
  }
  if (calculated[PromAlertingRuleState.Pending]) {
    statsComponents.push(
      <StateColoredText key="pending" status={PromAlertingRuleState.Pending}>
        {calculated[PromAlertingRuleState.Pending]} pending
      </StateColoredText>
    );
  }
  if (showInactive && calculated[PromAlertingRuleState.Inactive]) {
    statsComponents.push(
      <StateColoredText key="inactive" status="neutral">
        {calculated[PromAlertingRuleState.Inactive]} normal
      </StateColoredText>
    );
  }
  if (showRecording && calculated.recording) {
    statsComponents.push(
      <StateColoredText key="recording" status="neutral">
        {calculated.recording} recording
      </StateColoredText>
    );
  }

  return (
    <div>
      <span>
        {calculated.total} {pluralize('rule', calculated.total)}
      </span>
      {!!statsComponents.length && (
        <>
          <span>: </span>
          {statsComponents.reduce<React.ReactNode[]>(
            (prev, curr, idx) =>
              prev.length
                ? [
                    prev,
                    <Fragment key={idx}>
                      <span>, </span>
                    </Fragment>,
                    curr,
                  ]
                : [curr],
            []
          )}
        </>
      )}
    </div>
  );
};
