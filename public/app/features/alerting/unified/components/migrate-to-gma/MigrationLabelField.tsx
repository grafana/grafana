import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Field, Input, Stack, Text } from '@grafana/ui';

import { DEFAULT_MIGRATION_LABEL_NAME, MigrationFormValues } from './MigrateToGMA';

export function MigrationLabelField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<MigrationFormValues>();

  return (
    <Box maxWidth={600}>
      <Text variant="h5" element="h3">
        {t('alerting.migrate-to-gma.label.title', 'Migration label')}
      </Text>

      <Box marginTop={1} marginBottom={2}>
        <Alert severity="info" title="">
          <Trans i18nKey="alerting.migrate-to-gma.label.info">
            This label will be added to all imported alert rules and used as a matcher in the notification policy tree.
            It ensures that alerts from your migrated rules are routed to the correct contact points.
          </Trans>
        </Alert>
      </Box>

      <Stack direction="row" gap={2} alignItems="flex-start">
        <Field
          label={t('alerting.migrate-to-gma.label.name', 'Label name')}
          invalid={!!errors.migrationLabelName}
          error={errors.migrationLabelName?.message}
          noMargin
        >
          <Input
            {...register('migrationLabelName', {
              required: t('alerting.migrate-to-gma.label.name-required', 'Label name is required'),
              pattern: {
                value: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
                message: t(
                  'alerting.migrate-to-gma.label.name-pattern',
                  'Label name must start with a letter or underscore and contain only letters, numbers, and underscores'
                ),
              },
            })}
            placeholder={t('alerting.migrate-to-gma.label.name-placeholder', DEFAULT_MIGRATION_LABEL_NAME)}
            width={25}
          />
        </Field>

        <Field
          label={t('alerting.migrate-to-gma.label.value', 'Label value')}
          invalid={!!errors.migrationLabelValue}
          error={errors.migrationLabelValue?.message}
          noMargin
        >
          <Input
            {...register('migrationLabelValue', {
              required: t('alerting.migrate-to-gma.label.value-required', 'Label value is required'),
            })}
            placeholder={t('alerting.migrate-to-gma.label.value-placeholder', 'prometheus-prod')}
            width={25}
          />
        </Field>
      </Stack>

      <Box marginTop={1}>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="alerting.migrate-to-gma.label.example">
            Example: All imported rules will have the label <code>importedLabel=prometheus-prod</code> and the
            notification policy will match alerts with this label.
          </Trans>
        </Text>
      </Box>
    </Box>
  );
}
