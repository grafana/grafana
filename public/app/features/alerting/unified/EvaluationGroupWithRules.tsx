import React from 'react';
import { useToggle } from 'react-use';

import { EvaluationGroupWithRulesProps } from './RuleList.v2';
import { AlertRuleListItem, RecordingRuleListItem } from './components/rule-list/AlertRuleListItem';
import EvaluationGroup from './components/rule-list/EvaluationGroup';
import { createViewLink } from './utils/misc';
import { hashRulerRule } from './utils/rule-id';
import {
  isAlertingRule,
  isAlertingRulerRule,
  isGrafanaRulerRule,
  isRecordingRule,
  isRecordingRulerRule,
} from './utils/rules';

export const EvaluationGroupWithRules = ({ group, rulesSource }: EvaluationGroupWithRulesProps) => {
  const [open, toggleOpen] = useToggle(false);

  return (
    <EvaluationGroup name={group.name} interval={group.interval} isOpen={open} onToggle={toggleOpen}>
      {group.rules.map((rule) => {
        const { rulerRule, promRule, annotations } = rule;

        // keep in mind that we may not have a promRule for the ruler rule – this happens when the target
        // rule source is eventually consistent - it may know about the rule definition but not its state
        if (isAlertingRulerRule(rulerRule) && isAlertingRule(promRule)) {
          return (
            <AlertRuleListItem
              key={hashRulerRule(rulerRule)}
              state={promRule?.state}
              health={promRule?.health}
              error={promRule?.lastError}
              name={rulerRule.alert}
              labels={rulerRule.labels}
              lastEvaluation={promRule?.lastEvaluation}
              evaluationDuration={promRule?.evaluationTime}
              evaluationInterval={group.interval}
              href={createViewLink(rulesSource, rule)}
              summary={annotations?.['summary']}
            />
          );
        }

        if (isRecordingRulerRule(rulerRule) && isRecordingRule(promRule)) {
          return (
            <RecordingRuleListItem
              key={hashRulerRule(rulerRule)}
              name={rulerRule.record}
              health={promRule?.health}
              error={promRule?.lastError}
              lastEvaluation={promRule?.lastEvaluation}
              evaluationDuration={promRule?.evaluationTime}
              evaluationInterval={group.interval}
              labels={rulerRule.labels}
              href={createViewLink(rulesSource, rule)}
            />
          );
        }

        if (isGrafanaRulerRule(rulerRule) && isAlertingRule(promRule)) {
          return (
            <AlertRuleListItem
              key={rulerRule.grafana_alert.uid}
              name={rulerRule.grafana_alert.title}
              state={promRule?.state}
              labels={rulerRule.labels}
              health={promRule?.health}
              error={promRule?.lastError}
              isPaused={rulerRule.grafana_alert.is_paused}
              lastEvaluation={promRule?.lastEvaluation}
              evaluationDuration={promRule?.evaluationTime}
              evaluationInterval={group.interval}
              href={createViewLink(rulesSource, rule)}
              summary={rule.annotations?.['summary']}
              isProvisioned={Boolean(rulerRule.grafana_alert.provenance)}
            />
          );
        }

        return null;
      })}
    </EvaluationGroup>
  );
};
