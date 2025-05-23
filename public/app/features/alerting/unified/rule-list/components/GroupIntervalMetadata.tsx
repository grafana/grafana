import { Icon, Stack, Text } from '@grafana/ui';

import { formatPrometheusDuration } from '../../utils/time';

interface GroupIntervalIndicatorProps {
  seconds: number;
}

/*
 * @TODO maybe make this more generic by accepting props to change size and color?
 */
export const GroupIntervalIndicator = ({ seconds }: GroupIntervalIndicatorProps) => {
  const durationString = formatPrometheusDuration(seconds * 1000);

  return (
    <Text variant="bodySmall" color="secondary">
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="clock-nine" size="xs" /> {durationString}
      </Stack>
    </Text>
  );
};
