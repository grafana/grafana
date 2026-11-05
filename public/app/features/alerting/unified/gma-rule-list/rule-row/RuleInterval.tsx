import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';

interface RuleIntervalProps {
  interval: string;
}

/** Evaluation interval indicator for the row's right column. Always renders; let the caller guard on presence. */
export function RuleInterval({ interval }: RuleIntervalProps) {
  const label = t('alerting.gma-rule-list.interval', 'Evaluated every {{interval}}', {
    interpolation: { escapeValue: false },
    interval,
  });

  return (
    <Tooltip content={label} placement="top">
      <Stack direction="row" alignItems="center" gap={0.5} role="img" aria-label={label}>
        <Icon name="clock-nine" size="xs" />
        <Text variant="bodySmall" color="secondary">
          {interval}
        </Text>
      </Stack>
    </Tooltip>
  );
}
