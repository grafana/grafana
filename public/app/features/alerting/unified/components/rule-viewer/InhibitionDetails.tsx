import { Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

import { useRuleInhibitionMatches } from '../../hooks/useRuleInhibitionMatches';
import { DOCS_URL_INHIBITION_RULES } from '../../utils/docs';

interface InhibitionDetailsProps {
  labels: Labels;
}

export function InhibitionDetails({ labels }: InhibitionDetailsProps) {
  const { matches, isLoading } = useRuleInhibitionMatches(labels);

  if (isLoading || matches.length === 0) {
    return null;
  }

  const targetMatches = matches.filter((m) => m.role === 'target' || m.role === 'both');
  const sourceMatches = matches.filter((m) => m.role === 'source' || m.role === 'both');

  return (
    <>
      {targetMatches.length > 0 && (
        <Alert
          title={t(
            'alerting.rule-viewer.inhibition-details.target-title',
            'This alert rule may be suppressed by {{count}} inhibition rule(s)',
            { count: targetMatches.length }
          )}
          severity="warning"
        >
          <TextLink href={DOCS_URL_INHIBITION_RULES} external>
            <Trans i18nKey="alerting.rule-viewer.inhibition-details.learn-more">
              Learn more about inhibition rules
            </Trans>
          </TextLink>
        </Alert>
      )}
      {sourceMatches.length > 0 && (
        <Alert
          title={t(
            'alerting.rule-viewer.inhibition-details.source-title',
            'When firing, this alert rule may suppress alerts matched by {{count}} inhibition rule(s)',
            { count: sourceMatches.length }
          )}
          severity="info"
        >
          <TextLink href={DOCS_URL_INHIBITION_RULES} external>
            <Trans i18nKey="alerting.rule-viewer.inhibition-details.learn-more">
              Learn more about inhibition rules
            </Trans>
          </TextLink>
        </Alert>
      )}
    </>
  );
}
