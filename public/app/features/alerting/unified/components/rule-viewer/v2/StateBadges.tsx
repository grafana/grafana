import React from 'react';

import { Stack, Text } from '@grafana/ui';
import { RuleHealth } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertStateDot } from '../../AlertStateDot';

import { isErrorHealth } from './RuleViewer.v2';

interface RecordingBadgeProps {
  health?: RuleHealth;
}

export const RecordingBadge = ({ health }: RecordingBadgeProps) => {
  const hasError = isErrorHealth(health);

  const color = hasError ? 'error' : 'success';
  const text = hasError ? 'Recording error' : 'Recording';

  return (
    <Stack direction="row" gap={0.5}>
      <AlertStateDot color={color} />
      <Text variant="bodySmall" color={color}>
        {text}
      </Text>
    </Stack>
  );
};

// we're making a distinction here between the "state" of the rule and its "health".
interface StateBadgeProps {
  state: PromAlertingRuleState;
  health?: RuleHealth;
}

export const StateBadge = ({ state, health }: StateBadgeProps) => {
  let stateLabel: string;
  let color: 'success' | 'error' | 'warning';

  switch (state) {
    case PromAlertingRuleState.Inactive:
      color = 'success';
      stateLabel = 'Normal';
      break;
    case PromAlertingRuleState.Firing:
      color = 'error';
      stateLabel = 'Firing';
      break;
    case PromAlertingRuleState.Pending:
      color = 'warning';
      stateLabel = 'Pending';
      break;
  }

  // if the rule is in "error" health we don't really care about the state
  if (isErrorHealth(health)) {
    color = 'error';
    stateLabel = 'Error';
  }

  if (health === 'nodata') {
    color = 'warning';
    stateLabel = 'No data';
  }

  return (
    <Stack direction="row" gap={0.5}>
      <AlertStateDot color={color} />
      <Text variant="bodySmall" color={color}>
        {stateLabel}
      </Text>
    </Stack>
  );
};
