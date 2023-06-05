import pluralize from 'pluralize';
import React, { Fragment, useState } from 'react';
import { useDebounce } from 'react-use';

import { Stack } from '@grafana/experimental';
import { Badge } from '@grafana/ui';
import { CombinedRule, CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { isAlertingRule, isRecordingRule, isRecordingRulerRule, isGrafanaRulerRulePaused } from '../../utils/rules';

interface Props {
  includeTotal?: boolean;
  group?: CombinedRuleGroup;
  namespaces?: CombinedRuleNamespace[];
}

const emptyStats = {
  total: 0,
  recording: 0,
  [PromAlertingRuleState.Firing]: 0,
  [PromAlertingRuleState.Pending]: 0,
  [PromAlertingRuleState.Inactive]: 0,
  paused: 0,
  error: 0,
} as const;

export const RuleStats = ({ group, namespaces, includeTotal }: Props) => {
  const evaluationInterval = group?.interval;
  const [calculated, setCalculated] = useState(emptyStats);

  // Performance optimization allowing reducing number of stats calculation
  // The problem occurs when we load many data sources.
  // Then redux store gets updated multiple times in a pretty short period, triggering calculating stats many times.
  // debounce allows to skip calculations which results would be abandoned in milliseconds
  useDebounce(
    () => {
      const stats = { ...emptyStats };

      const calcRule = (rule: CombinedRule) => {
        if (rule.promRule && isAlertingRule(rule.promRule)) {
          if (isGrafanaRulerRulePaused(rule)) {
            stats.paused += 1;
          }
          stats[rule.promRule.state] += 1;
        }
        if (ruleHasError(rule)) {
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

      setCalculated(stats);
    },
    400,
    [group, namespaces]
  );

  const statsComponents: React.ReactNode[] = [];

  if (includeTotal) {
    statsComponents.push(
      <Fragment key="total">
        {calculated.total} {pluralize('rule', calculated.total)}
      </Fragment>
    );
  }

  if (calculated[PromAlertingRuleState.Firing]) {
    statsComponents.push(
      <Badge color="red" key="firing" text={`${calculated[PromAlertingRuleState.Firing]} firing`} />
    );
  }

  if (calculated.error) {
    statsComponents.push(<Badge color="red" key="errors" text={`${calculated.error} errors`} />);
  }

  if (calculated[PromAlertingRuleState.Pending]) {
    statsComponents.push(
      <Badge color={'orange'} key="pending" text={`${calculated[PromAlertingRuleState.Pending]} pending`} />
    );
  }

  if (calculated[PromAlertingRuleState.Inactive] && calculated.paused) {
    statsComponents.push(
      <Badge
        color="green"
        key="paused"
        text={`${calculated[PromAlertingRuleState.Inactive]} normal (${calculated.paused} paused)`}
      />
    );
  }

  if (calculated[PromAlertingRuleState.Inactive] && !calculated.paused) {
    statsComponents.push(
      <Badge color="green" key="inactive" text={`${calculated[PromAlertingRuleState.Inactive]} normal`} />
    );
  }

  if (calculated.recording) {
    statsComponents.push(<Badge color="purple" key="recording" text={`${calculated.recording} recording`} />);
  }

  const hasStats = Boolean(statsComponents.length);

  return (
    <Stack direction="row">
      {hasStats && (
        <div>
          <Stack gap={0.5}>{statsComponents}</Stack>
        </div>
      )}
      {evaluationInterval && (
        <>
          <div>|</div>
          <Badge text={evaluationInterval} icon="clock-nine" color={'blue'} />
        </>
      )}
    </Stack>
  );
};

function ruleHasError(rule: CombinedRule) {
  return rule.promRule?.health === 'err' || rule.promRule?.health === 'error';
}
