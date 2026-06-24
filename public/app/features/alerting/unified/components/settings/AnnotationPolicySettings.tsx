import { Trans, t } from '@grafana/i18n';
import { Box, Field, Stack, Switch, Text } from '@grafana/ui';

import { useSettings } from './SettingsContext';

export function AnnotationPolicySettings() {
  const { configuration, isUpdating, setRejectAlertsWithoutDescriptions, setAutoFillDescriptionsWithAI } =
    useSettings();

  const rejectEnabled = configuration?.reject_alerts_without_descriptions ?? false;
  const autoFillEnabled = configuration?.auto_fill_descriptions_with_ai ?? false;

  return (
    <Box>
      <Stack direction="column" gap={1}>
        <Text variant="h5">
          <Trans i18nKey="alerting.annotation-policy.title">Alert rules</Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.annotation-policy.description">
            Control how missing summary and description annotations are handled when alert rules are created or updated.
          </Trans>
        </Text>

        <Field
          label={t('alerting.annotation-policy.reject-label', 'Require alert descriptions')}
          description={t(
            'alerting.annotation-policy.reject-description',
            'Alerts without a description will be rejected at save time. Use this to enforce documentation standards across your team.'
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
          label={t('alerting.annotation-policy.autofill-label', 'Auto-fill descriptions with AI')}
          description={t(
            'alerting.annotation-policy.autofill-description',
            'When an alert is saved without a description, generate one from the alert name, query, and labels. You can edit it at any time.'
          )}
          horizontal
        >
          <Switch
            value={autoFillEnabled}
            disabled={isUpdating}
            onChange={(e) => setAutoFillDescriptionsWithAI(e.currentTarget.checked)}
          />
        </Field>
      </Stack>
    </Box>
  );
}
