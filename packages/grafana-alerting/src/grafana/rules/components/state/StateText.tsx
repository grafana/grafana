import { ReactNode } from 'react';

import { Stack, Text } from '@grafana/ui';

import { StateDot } from './StateDot';
import { Health, State } from './types';

// we're making a distinction here between the "state" of the rule and its "health".
// When the type is "recording" we only support the health property.
type StateTextProps =
  | {
      state?: State;
      health?: Health;
      type?: 'alerting';
    }
  | {
      health?: Health;
      state?: never;
      type: 'recording';
    };

export const StateText = ({ state, health, type = 'alerting' }: StateTextProps) => {
  let stateLabel: string;
  let color: TextColor;

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

  // recording rule badge
  // @TODO do recording rules support "nodata" state?
  if (type === 'recording') {
    const text = health === 'error' ? 'Recording error' : 'Recording';
    const color = health === 'error' ? 'error' : 'success';

    return <InnerText color={color} text={text} />;
  }

  return <InnerText color={color} text={stateLabel} />;
};

// the generic badge component
type TextColor = 'success' | 'error' | 'warning' | 'unknown';

interface InnerTextProps {
  color: TextColor;
  text: NonNullable<ReactNode>;
}

// the inner badge component doesn't care about the semantics of "state" or "health" but just renders
// a badge in a specific text color and a dot in matching color.
// We currently don't expose this component outside of this file.
function InnerText({ color, text }: InnerTextProps) {
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
