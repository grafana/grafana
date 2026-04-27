import { type ComponentProps, type ReactNode } from 'react';

import { Trans } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

import { StateDot } from './StateDot';
import { type Health, type State } from './types';

// we're making a distinction here between the "state" of the rule and its "health".
// When the type is "recording" we only support the health property.
type CommonStateTextProps = {
  health?: Health;
  isPaused?: boolean;
};

interface AlertingStateTextProps extends CommonStateTextProps {
  type?: 'alerting';
  state?: State;
}

interface RecordingStateTextProps extends CommonStateTextProps {
  type: 'recording';
  state?: never;
}

type StateTextProps = AlertingStateTextProps | RecordingStateTextProps;

export const StateText = ({ state, health, type = 'alerting', isPaused = false }: StateTextProps) => {
  if (isPaused) {
    return <PausedText />;
  }

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
    case 'inhibited':
      color = 'info';
      stateLabel = 'Inhibited';
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
    const isRecordingError = health === 'error';
    const recordingText = isRecordingError ? 'Recording error' : 'Recording';
    const recordingColor: TextColor = isRecordingError ? 'error' : 'success';

    return <InnerText color={recordingColor} text={recordingText} />;
  }

  return <InnerText color={color} text={stateLabel} />;
};

// the generic badge component
type TextColor = 'success' | 'error' | 'warning' | 'unknown' | 'info';

interface InnerTextProps {
  color: TextColor;
  text: NonNullable<ReactNode>;
}

// the inner badge component doesn't care about the semantics of "state" or "health" but just renders
// a badge in a specific text color and a dot in matching color.
// We currently don't expose this component outside of this file.
function InnerText({ color, text }: InnerTextProps) {
  let textColor: ComponentProps<typeof Text>['color'];
  if (color === 'unknown') {
    textColor = 'secondary';
  } else {
    textColor = color;
  }

  return (
    <Stack direction="row" gap={0.5} wrap="nowrap" flex="0 0 auto" alignItems="center">
      <StateDot color={color} />
      <Text variant="bodySmall" color={textColor}>
        {text}
      </Text>
    </Stack>
  );
}

function PausedText() {
  return (
    <Text variant="bodySmall" color="warning">
      <Stack direction="row" gap={0.5} wrap="nowrap" flex="0 0 auto" alignItems="center">
        <Icon name="pause" size="xs" />
        <Trans i18nKey="alerting.paused-badge.paused">Paused</Trans>
      </Stack>
    </Text>
  );
}
