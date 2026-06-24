import { Trans, t } from '@grafana/i18n';
import { Box, Field, Stack, Switch, Text } from '@grafana/ui';

import { useSettings } from './SettingsContext';

export function AnnotationPolicySettings() {
  const {
    configuration,
    isUpdating,
    setRejectAlertsWithoutDescriptions,
    setAutoFillDescriptionsWithAI,
    setRejectAlertsWithoutRunbookURL,
  } = useSettings();

  const rejectEnabled = configuration?.reject_alerts_without_descriptions ?? false;
  const autoFillEnabled = configuration?.auto_fill_descriptions_with_ai ?? false;
  const rejectRunbookEnabled = configuration?.reject_alerts_without_runbook_url ?? false;

  return (
    <Box>
      <Stack direction="column" gap={1}>
        <Text variant="h5">
          <Trans i18nKey="alerting.annotation-policy.title">Alert quality</Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.annotation-policy.description">
            Control whether alert rules must include descriptions, summaries, and runbook links — and whether Grafana
            can generate missing descriptions automatically.
          </Trans>
        </Text>

        <Field
          label={t('alerting.annotation-policy.reject-label', 'Require descriptions and summaries')}
          description={t(
            'alerting.annotation-policy.reject-description',
            'Alert rules without a summary or description can\'t be saved. Enable "Auto-fill with AI" to generate them automatically.'
          )}
          horizontal
        >
          <Switch
            value={rejectEnabled}
            disabled={isUpdating}
            onChange={(e) => setRejectAlertsWithoutDescriptions(e.currentTarget.checked)}
          />
        </Field>

        <Field
          label={t('alerting.annotation-policy.autofill-label', 'Auto-fill descriptions and summaries with AI')}
          description={t(
            'alerting.annotation-policy.autofill-description',
            'When an alert rule is saved without a description or summary, Grafana generates both using AI — based on the alert name, query, and labels. You can edit them at any time.'
          )}
          horizontal
        >
          <Switch
            value={autoFillEnabled}
            disabled={isUpdating}
            onChange={(e) => setAutoFillDescriptionsWithAI(e.currentTarget.checked)}
          />
        </Field>

        <Field
          label={t('alerting.annotation-policy.reject-runbook-label', 'Require runbook URL')}
          description={t(
            'alerting.annotation-policy.reject-runbook-description',
            'Alert rules without a runbook URL can\'t be saved.'
          )}
          horizontal
        >
          <Switch
            value={rejectRunbookEnabled}
            disabled={isUpdating}
            onChange={(e) => setRejectAlertsWithoutRunbookURL(e.currentTarget.checked)}
          />
        </Field>
      </Stack>
    </Box>
  );
}
