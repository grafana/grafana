import { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

import { StateDot } from './StateDot';
import { Health, State } from './types';

interface RecordingBadgeProps {
  health?: Health;
}

export const RecordingBadge = ({ health }: RecordingBadgeProps) => {
  const hasError = health === 'error';

  const color = hasError ? 'error' : 'success';
  const text = hasError ? 'Recording error' : 'Recording';

  return <Badge color={color} text={text} />;
};

// we're making a distinction here between the "state" of the rule and its "health".
interface StateBadgeProps {
  state?: State;
  health?: Health;
}

export const StateBadge = ({ state, health }: StateBadgeProps) => {
  let stateLabel: string;
  let color: BadgeColor;

  switch (state) {
    case 'normal':
      color = 'success';
      stateLabel = 'Normal';
      break;
    case 'firing':
      color = 'error';
      stateLabel = 'Firing';
      break;
    case 'pending':
      color = 'warning';
      stateLabel = 'Pending';
      break;
    case 'recovering':
      color = 'warning';
      stateLabel = 'Recovering';
      break;
    case 'unknown':
    default:
      color = 'unknown';
      stateLabel = 'Unknown';
      break;
  }

  // if the rule is in "error" health we don't really care about the state
  if (health === 'error') {
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
type BadgeColor = 'success' | 'error' | 'warning' | 'unknown';

interface BadgeProps {
  color: BadgeColor;
  text: NonNullable<ReactNode>;
}

// the inner badge component doesn't care about the semantics of "state" or "health" but just renders
// a badge in a specific text color and a dot in matching color.
// We currently don't expose this component outside of this file.
function Badge({ color, text }: BadgeProps) {
  const textColor = color === 'unknown' ? 'secondary' : color;

  return (
    <Stack direction="row" gap={0.5} wrap={'nowrap'} flex={'0 0 auto'}>
      <StateDot color={color} />
      <Text variant="bodySmall" color={textColor}>
        {text}
      </Text>
    </Stack>
  );
}
