import { Icon, Stack, Text } from '@grafana/ui';

interface IntervalIndicatorProps {
  /** Pre-formatted duration, e.g. `1m`. Nothing is rendered while unknown rather than a placeholder. */
  interval?: string;
}

export function IntervalIndicator({ interval }: IntervalIndicatorProps) {
  if (!interval) {
    return null;
  }

  return (
    <Text variant="bodySmall" color="secondary">
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="clock-nine" size="xs" />
        {interval}
      </Stack>
    </Text>
  );
}
