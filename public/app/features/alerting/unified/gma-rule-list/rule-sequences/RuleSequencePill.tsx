import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

interface RuleSequencePillProps {
  interval?: string;
}

export function RuleSequencePill({ interval }: RuleSequencePillProps) {
  const text = interval
    ? t('alerting.gma-rule-list.sequence-pill.label-with-interval', 'Rule sequence · {{interval}}', {
        interpolation: { escapeValue: false },
        interval,
      })
    : t('alerting.gma-rule-list.sequence-pill.label', 'Rule sequence');
  const tooltip = interval
    ? t(
        'alerting.gma-rule-list.sequence-pill.tooltip-with-interval',
        'Evaluated every {{interval}} by its rule sequence',
        {
          interpolation: { escapeValue: false },
          interval,
        }
      )
    : t('alerting.gma-rule-list.sequence-pill.tooltip', 'Evaluated as part of a rule sequence');

  return <Badge color="darkgrey" icon="multi-step" text={text} tooltip={tooltip} />;
}
