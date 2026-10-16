import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';

interface IntervalIndicatorProps {
  interval?: string;
}

export function IntervalIndicator({ interval }: IntervalIndicatorProps) {
  if (!interval) {
    return null;
  }

  const label = t('alerting.gma-rule-list.interval-indicator.label', 'Evaluated every {{interval}}', { interval });

  return (
    <Tooltip content={label}>
      <span aria-label={label} role="img">
        <Text variant="bodySmall" color="secondary">
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Icon name="clock-nine" size="xs" />
            {interval}
          </Stack>
        </Text>
      </span>
    </Tooltip>
  );
}
