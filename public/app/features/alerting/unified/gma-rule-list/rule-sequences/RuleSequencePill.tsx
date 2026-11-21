import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface RuleSequencePillProps {
  interval: string;
  onClick: () => void;
}

export function RuleSequencePill({ interval, onClick }: RuleSequencePillProps) {
  const text = t('alerting.gma-rule-list.sequence-pill.label-with-interval', 'Rule sequence · {{interval}}', {
    interpolation: { escapeValue: false },
    interval,
  });
  const tooltip = t(
    'alerting.gma-rule-list.sequence-pill.tooltip-with-interval',
    'Evaluated every {{interval}} by its rule sequence',
    { interpolation: { escapeValue: false }, interval }
  );

  return (
    <Button size="sm" variant="secondary" fill="outline" icon="multi-step" tooltip={tooltip} onClick={onClick}>
      {text}
    </Button>
  );
}
