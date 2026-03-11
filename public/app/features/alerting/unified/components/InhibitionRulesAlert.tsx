import { ComponentPropsWithoutRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink, Tooltip } from '@grafana/ui';

import { useHasInhibitionRules } from '../hooks/useHasInhibitionRules';
import { DOCS_URL_INHIBITION_RULES } from '../utils/docs';

type ExtraAlertProps = Omit<ComponentPropsWithoutRef<typeof Alert>, 'title' | 'severity'>;

interface InhibitionRulesAlertProps extends ExtraAlertProps {
  alertmanagerSourceName: string;
  /** When true, renders a compact header-only alert with the description in a tooltip */
  compact?: boolean;
}

export function InhibitionRulesAlert({ alertmanagerSourceName, compact, ...rest }: InhibitionRulesAlertProps) {
  const { hasInhibitionRules, isLoading } = useHasInhibitionRules(alertmanagerSourceName);

  if (isLoading || !hasInhibitionRules) {
    return null;
  }

  const title = t('alerting.inhibition-rules.title', 'Inhibition rules are in effect');

  const body = (
    <>
      <Trans i18nKey="alerting.inhibition-rules.body">
        This Alertmanager has inhibition rules configured. Some alerts may be suppressed when matching alerts are
        firing.
      </Trans>{' '}
      <TextLink href={DOCS_URL_INHIBITION_RULES} external inline>
        <Trans i18nKey="alerting.inhibition-rules.learn-more">Learn more about inhibition rules</Trans>
      </TextLink>
    </>
  );

  if (compact) {
    return (
      <Tooltip content={body} interactive>
        <div>
          <Alert title={title} severity="warning" bottomSpacing={0} topSpacing={0} />
        </div>
      </Tooltip>
    );
  }

  return (
    <Alert title={title} severity="warning" {...rest}>
      {body}
    </Alert>
  );
}
