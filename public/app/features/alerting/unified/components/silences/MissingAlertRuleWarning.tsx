import { Trans, t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip } from '@grafana/ui';

interface MissingAlertRuleWarningProps {
  ruleUid: string;
}

export function MissingAlertRuleWarning({ ruleUid }: MissingAlertRuleWarningProps) {
  const tooltipContent = t('alerting.silences.missing-alert-rule-warning.tooltip', 'Alert rule UID: {{ruleUid}}', {
    ruleUid,
  });

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Tooltip content={tooltipContent}>
        <Icon name="exclamation-triangle" aria-label={tooltipContent} />
      </Tooltip>
      <Text color="warning">
        <Trans i18nKey="alerting.silences.missing-alert-rule-warning.text">Alert rule no longer exists</Trans>
      </Text>
    </Stack>
  );
}
