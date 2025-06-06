import { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';
import { RuleHealth } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertStateDot } from '../AlertStateDot';

import { isErrorHealth } from './RuleViewer';

interface RecordingBadgeProps {
  health?: RuleHealth;
}

export const RecordingBadge = ({ health }: RecordingBadgeProps) => {
  const hasError = isErrorHealth(health);

  const color = hasError ? 'error' : 'success';
  const text = hasError ? 'Recording error' : 'Recording';

  return <Badge color={color} text={text} />;
};

// we're making a distinction here between the "state" of the rule and its "health".
interface StateBadgeProps {
  state: PromAlertingRuleState;
  health?: RuleHealth;
}

export const StateBadge = ({ state, health }: StateBadgeProps) => {
  let stateLabel: string;
  let color: BadgeColor;

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
    case PromAlertingRuleState.Recovering:
      color = 'warning';
      stateLabel = 'Recovering';
      break;
    case PromAlertingRuleState.Unknown:
      color = 'info';
      stateLabel = 'Unknown';
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

  return <Badge color={color} text={stateLabel} />;
};

// the generic badge component
type BadgeColor = 'success' | 'error' | 'warning' | 'info';

interface BadgeProps {
  color: BadgeColor;
  text: NonNullable<ReactNode>;
}

function Badge({ color, text }: BadgeProps) {
  return (
    <Stack direction="row" gap={0.5} wrap={'nowrap'} flex={'0 0 auto'}>
      <AlertStateDot color={color} />
      <Text variant="bodySmall" color={color}>
        {text}
      </Text>
    </Stack>
  );
}
