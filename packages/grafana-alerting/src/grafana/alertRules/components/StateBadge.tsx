import { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

import { StateDot } from './StateDot';

type Health = 'nodata' | 'error';
type State = 'normal' | 'firing' | 'pending' | 'unknown' | 'recovering';

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
export interface StateBadgeProps {
  state: State;
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
      color = 'secondary';
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
type BadgeColor = 'success' | 'error' | 'warning' | 'info' | 'secondary';

interface BadgeProps {
  color: BadgeColor;
  text: NonNullable<ReactNode>;
}

function Badge({ color, text }: BadgeProps) {
  return (
    <Stack direction="row" gap={0.5} wrap={'nowrap'} flex={'0 0 auto'}>
      <StateDot color={color} />
      <Text variant="bodySmall" color={color}>
        {text}
      </Text>
    </Stack>
  );
}
