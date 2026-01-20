import { ComponentPropsWithoutRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

import { useHasInhibitionRules } from '../hooks/useHasInhibitionRules';

const INHIBITION_RULES_DOCS_URL =
  'https://grafana.com/docs/grafana/latest/alerting/configure-notifications/create-silence/#inhibition-rules';

type ExtraAlertProps = Omit<ComponentPropsWithoutRef<typeof Alert>, 'title' | 'severity'>;

interface InhibitionRulesAlertProps extends ExtraAlertProps {
  alertmanagerSourceName: string;
}

export function InhibitionRulesAlert({ alertmanagerSourceName, ...rest }: InhibitionRulesAlertProps) {
  const { hasInhibitionRules, isLoading } = useHasInhibitionRules(alertmanagerSourceName);

  if (isLoading || !hasInhibitionRules) {
    return null;
  }

  return (
    <Alert title={t('alerting.inhibition-rules.title', 'Inhibition rules are in effect')} severity="info" {...rest}>
      <Trans i18nKey="alerting.inhibition-rules.body">
        This Alertmanager has inhibition rules configured. Some alerts may be suppressed when matching alerts are
        firing.
      </Trans>{' '}
      <TextLink href={INHIBITION_RULES_DOCS_URL} external>
        <Trans i18nKey="alerting.inhibition-rules.learn-more">Learn more about inhibition rules</Trans>
      </TextLink>
    </Alert>
  );
}
