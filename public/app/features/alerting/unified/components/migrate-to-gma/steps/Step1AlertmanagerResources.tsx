import { css } from '@emotion/css';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Button,
  Field,
  FileUpload,
  Icon,
  Input,
  RadioButtonList,
  Select,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { getAlertManagerDataSources } from '../../../utils/datasource';
import { DEFAULT_MIGRATION_LABEL_NAME, MigrationFormValues } from '../MigrateToGMA';

interface Step1Props {
  onComplete: () => void;
  onSkip: () => void;
  /** Whether the user has permission to import notifications */
  canImport: boolean;
}

export function Step1AlertmanagerResources({ onComplete, onSkip, canImport }: Step1Props) {
  const styles = useStyles2(getStyles);
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MigrationFormValues>();

  const [
    notificationsSource,
    migrationLabelName,
    migrationLabelValue,
    notificationsDatasourceUID,
    notificationsYamlFile,
  ] = watch([
    'notificationsSource',
    'migrationLabelName',
    'migrationLabelValue',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
  ]);

  const sourceOptions = [
    {
      label: t('alerting.migrate-to-gma.step1.source.yaml', 'YAML file'),
      description: t(
        'alerting.migrate-to-gma.step1.source.yaml-desc',
        'Import from an Alertmanager configuration YAML file'
      ),
      value: 'yaml' as const,
    },
    {
      label: t('alerting.migrate-to-gma.step1.source.datasource', 'Data source'),
      description: t('alerting.migrate-to-gma.step1.source.datasource-desc', 'Import from an Alertmanager data source'),
      value: 'datasource' as const,
    },
  ];

  const canProceed = () => {
    // Can't proceed without permission
    if (!canImport) {
      return false;
    }
    if (!migrationLabelName || !migrationLabelValue) {
      return false;
    }
    if (notificationsSource === 'yaml' && !notificationsYamlFile) {
      return false;
    }
    if (notificationsSource === 'datasource' && !notificationsDatasourceUID) {
      return false;
    }
    return true;
  };

  return (
    <Stack direction="column" gap={3}>
      {/* Header */}
      <Box>
        <Text variant="h3" element="h2">
          {t('alerting.migrate-to-gma.step1.heading', '1. Import Notification Resources')}
        </Text>
        <Text color="secondary">
          <Trans i18nKey="alerting.migrate-to-gma.step1.subtitle">
            Import contact points, notification policies, templates, and mute timings from an external Alertmanager.
          </Trans>
        </Text>
      </Box>

      {/* Permission warning */}
      {!canImport && (
        <Alert
          severity="warning"
          title={t('alerting.migrate-to-gma.step1.no-permission-title', 'Insufficient permissions')}
        >
          <Trans i18nKey="alerting.migrate-to-gma.step1.no-permission-desc">
            You do not have permission to import notification resources. You need the{' '}
            <strong>alerting.notifications:write</strong> permission. You can skip this step.
          </Trans>
        </Alert>
      )}

      {/* Migration Label Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.migrate-to-gma.step1.label-title', 'Migration Label')}
          </Text>
        </div>
        <div className={styles.cardContent}>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.migrate-to-gma.step1.label-desc">
              This label will be used as a matcher in the imported notification policy tree to route alerts from the
              imported rules to the correct contact points.
            </Trans>
          </Text>
          <Box marginTop={2}>
            <Stack direction="row" gap={2}>
              <Field
                label={t('alerting.migrate-to-gma.step1.label-name', 'Label name')}
                invalid={!!errors.migrationLabelName}
                error={errors.migrationLabelName?.message}
                noMargin
              >
                <Input
                  {...register('migrationLabelName', { required: 'Label name is required' })}
                  placeholder={t('alerting.migrate-to-gma.step1.label-name-placeholder', DEFAULT_MIGRATION_LABEL_NAME)}
                  width={25}
                />
              </Field>
              <Field
                label={t('alerting.migrate-to-gma.step1.label-value', 'Label value')}
                invalid={!!errors.migrationLabelValue}
                error={errors.migrationLabelValue?.message}
                noMargin
              >
                <Input
                  {...register('migrationLabelValue', { required: 'Label value is required' })}
                  placeholder={t('alerting.migrate-to-gma.step1.label-value-placeholder', 'prometheus-prod')}
                  width={25}
                />
              </Field>
            </Stack>
          </Box>
        </div>
      </div>

      {/* Import Source Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.migrate-to-gma.step1.source-title', 'Import Source')}
          </Text>
        </div>
        <div className={styles.cardContent}>
          <Field noMargin>
            <Controller
              render={({ field: { onChange, ref, ...field } }) => (
                <RadioButtonList
                  {...field}
                  onChange={(value) => setValue('notificationsSource', value)}
                  options={sourceOptions}
                />
              )}
              control={control}
              name="notificationsSource"
            />
          </Field>

          <Box marginTop={2}>
            {notificationsSource === 'yaml' && (
              <Field
                label={t('alerting.migrate-to-gma.step1.yaml-file', 'Alertmanager config YAML')}
                invalid={!!errors.notificationsYamlFile}
                error={errors.notificationsYamlFile?.message}
                noMargin
              >
                <Controller
                  render={({ field: { ref, onChange, value, ...field } }) => (
                    <FileUpload
                      {...field}
                      accept=".yaml,.yml"
                      onFileUpload={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                          onChange(file);
                        }
                      }}
                    >
                      {notificationsYamlFile
                        ? notificationsYamlFile.name
                        : t('alerting.migrate-to-gma.step1.upload', 'Upload YAML file')}
                    </FileUpload>
                  )}
                  control={control}
                  name="notificationsYamlFile"
                />
              </Field>
            )}

            {notificationsSource === 'datasource' && <AlertmanagerDataSourceSelect />}
          </Box>
        </div>
      </div>

      {/* Actions */}
      <Stack direction="row" gap={2}>
        <Button variant="secondary" onClick={onSkip}>
          {t('alerting.migrate-to-gma.step1.skip', 'Skip this step')}
        </Button>
        <Button variant="primary" onClick={onComplete} disabled={!canProceed()}>
          <Icon name="arrow-right" />
          {t('alerting.migrate-to-gma.step1.continue', 'Continue')}
        </Button>
      </Stack>
    </Stack>
  );
}

/**
 * Component to select an Alertmanager data source (excludes Grafana built-in)
 */
function AlertmanagerDataSourceSelect() {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<MigrationFormValues>();

  // Get external Alertmanager data sources (same function used by AlertManagerPicker)
  const alertmanagerOptions: Array<SelectableValue<string>> = useMemo(() => {
    const alertmanagerDataSources = getAlertManagerDataSources();
    return alertmanagerDataSources.map((ds) => ({
      label: ds.name,
      value: ds.uid,
      imgUrl: ds.meta.info.logos.small,
      description: ds.url || undefined,
    }));
  }, []);

  return (
    <Field
      label={t('alerting.migrate-to-gma.step1.datasource', 'Alertmanager data source')}
      invalid={!!errors.notificationsDatasourceUID}
      error={errors.notificationsDatasourceUID?.message}
      noMargin
    >
      <Controller
        render={({ field: { ref, onChange, ...field } }) => (
          <Select
            {...field}
            options={alertmanagerOptions}
            onChange={(selected) => {
              if (selected?.value) {
                onChange(selected.value);
                // Also set the name for API calls
                const ds = getAlertManagerDataSources().find((d) => d.uid === selected.value);
                setValue('notificationsDatasourceName', ds?.name ?? null);
              }
            }}
            placeholder={t('alerting.migrate-to-gma.step1.select-datasource', 'Select data source')}
            width={40}
            noOptionsMessage={t('alerting.migrate-to-gma.step1.no-datasources', 'No Alertmanager data sources found')}
          />
        )}
        control={control}
        name="notificationsDatasourceUID"
      />
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  cardHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  cardContent: css({
    padding: theme.spacing(2),
  }),
});
