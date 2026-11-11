import { t } from '@grafana/i18n';

export type RuleKind = 'alert' | 'recording';

/** "12 alert rules", with the number formatted for the locale and a `+` when it is only a lower bound. */
export function ruleCountLabel(kind: RuleKind, count: number, isLowerBound = false): string {
  const formatted = new Intl.NumberFormat().format(count) + (isLowerBound ? '+' : '');
  if (kind === 'alert') {
    return t('alerting.gma-rule-list.rule-count.alert-rules', '', {
      count,
      formatted,
      defaultValue_one: '{{formatted}} alert rule',
      defaultValue_other: '{{formatted}} alert rules',
    });
  }
  return t('alerting.gma-rule-list.rule-count.recording-rules', '', {
    count,
    formatted,
    defaultValue_one: '{{formatted}} recording rule',
    defaultValue_other: '{{formatted}} recording rules',
  });
}
