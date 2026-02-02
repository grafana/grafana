import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Field,
  FileUpload,
  Input,
  RadioButtonList,
  Select,
  Spinner,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { getAlertManagerDataSources } from '../../../utils/datasource';
import { DryRunValidationResult } from '../DryRunValidationModal';
import { ImportFormValues } from '../ImportToGMA';

interface Step1ContentProps {
  /** Whether the user has permission to import notifications */
  canImport: boolean;
  /** Callback to report validation state changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Dry-run validation state */
  dryRunState?: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  /** Dry-run validation result */
  dryRunResult?: DryRunValidationResult;
  /** Callback to trigger dry-run validation */
  onTriggerDryRun?: () => void;
}

/**
 * Step1Content - Content for the notification resources import step
 * This component contains only the form fields, without the header or action buttons
 * The WizardStep wrapper provides those
 */
export function Step1Content({
  canImport,
  onValidationChange,
  dryRunState,
  dryRunResult,
  onTriggerDryRun,
}: Step1ContentProps) {
  const styles = useStyles2(getStyles);
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const [notificationsSource, policyTreeName, notificationsDatasourceUID, notificationsYamlFile] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
  ]);

  // Trigger dry-run when source selection changes and all required fields are filled
  const canRunDryRun = useMemo(() => {
    if (!policyTreeName) {
      return false;
    }
    if (notificationsSource === 'yaml' && !notificationsYamlFile) {
      return false;
    }
    if (notificationsSource === 'datasource' && !notificationsDatasourceUID) {
      return false;
    }
    return true;
  }, [policyTreeName, notificationsSource, notificationsYamlFile, notificationsDatasourceUID]);

  // Auto-trigger dry-run when conditions are met
  useEffect(() => {
    if (canRunDryRun && onTriggerDryRun) {
      onTriggerDryRun();
    }
  }, [
    canRunDryRun,
    onTriggerDryRun,
    notificationsSource,
    notificationsYamlFile,
    notificationsDatasourceUID,
    policyTreeName,
  ]);

  const sourceOptions = [
    {
      label: t('alerting.import-to-gma.step1.source.yaml', 'YAML file'),
      description: t(
        'alerting.import-to-gma.step1.source.yaml-desc',
        'Import from an Alertmanager configuration YAML file'
      ),
      value: 'yaml' as const,
    },
    {
      label: t('alerting.import-to-gma.step1.source.datasource', 'Data source'),
      description: t('alerting.import-to-gma.step1.source.datasource-desc', 'Import from an Alertmanager data source'),
      value: 'datasource' as const,
    },
  ];

  // Validation logic - same as before
  const isValid = useMemo(() => {
    // Can't proceed without permission
    if (!canImport) {
      return false;
    }
    if (!policyTreeName) {
      return false;
    }
    if (notificationsSource === 'yaml' && !notificationsYamlFile) {
      return false;
    }
    if (notificationsSource === 'datasource' && !notificationsDatasourceUID) {
      return false;
    }
    return true;
  }, [canImport, policyTreeName, notificationsSource, notificationsYamlFile, notificationsDatasourceUID]);

  // Report validation changes to parent
  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  return (
    <Stack direction="column" gap={3}>
      {/* Permission warning */}
      {!canImport && (
        <Alert
          severity="warning"
          title={t('alerting.import-to-gma.step1.no-permission-title', 'Insufficient permissions')}
        >
          <Trans i18nKey="alerting.import-to-gma.step1.no-permission-desc">
            You do not have permission to import notification resources. You need the{' '}
            <strong>alerting.notifications:write</strong> permission. You can skip this step.
          </Trans>
        </Alert>
      )}

      {/* Policy Tree Name Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step1.policy-tree-title', 'Policy Tree Name')}
          </Text>
        </div>
        <div className={styles.cardContent}>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="alerting.import-to-gma.step1.policy-tree-desc">
              Name for the imported notification policy tree. Alerts with the label{' '}
              <code>__grafana_managed_route__</code> matching this name will be routed through this policy tree.
            </Trans>
          </Text>
          <Box marginTop={2}>
            <Field
              label={t('alerting.import-to-gma.step1.policy-tree-name', 'Policy tree name')}
              invalid={!!errors.policyTreeName}
              error={errors.policyTreeName?.message}
              noMargin
            >
              <Input
                {...register('policyTreeName', { required: 'Policy tree name is required' })}
                placeholder={t('alerting.import-to-gma.step1.policy-tree-placeholder', 'prometheus-prod')}
                width={40}
              />
            </Field>
          </Box>
        </div>
      </div>

      {/* Import Source Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step1.source-title', 'Import Source')}
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
                label={t('alerting.import-to-gma.step1.yaml-file', 'Alertmanager config YAML')}
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
                        : t('alerting.import-to-gma.step1.upload', 'Upload YAML file')}
                    </FileUpload>
                  )}
                  control={control}
                  name="notificationsYamlFile"
                />
              </Field>
            )}

            {notificationsSource === 'datasource' && (
              <AlertmanagerDataSourceSelect onSelectionChange={onTriggerDryRun} />
            )}
          </Box>
        </div>
      </div>

      {/* Validation Status */}
      {canRunDryRun && dryRunState && dryRunState !== 'idle' && (
        <ValidationStatus state={dryRunState} result={dryRunResult} />
      )}
    </Stack>
  );
}

// Validation Status Component
interface ValidationStatusProps {
  state: 'loading' | 'success' | 'warning' | 'error';
  result?: DryRunValidationResult;
}

function ValidationStatus({ state, result }: ValidationStatusProps) {
  const styles = useStyles2(getValidationStyles);

  if (state === 'loading') {
    return (
      <div className={styles.statusContainer}>
        <Stack direction="row" gap={1} alignItems="center">
          <Spinner size="sm" />
          <Text color="secondary">{t('alerting.import-to-gma.step1.validating', 'Validating configuration...')}</Text>
        </Stack>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <Alert severity="success" title={t('alerting.import-to-gma.step1.validation-success', 'Validation successful')}>
        <Trans i18nKey="alerting.import-to-gma.step1.validation-success-desc">
          No conflicts found. The configuration is ready to import.
        </Trans>
      </Alert>
    );
  }

  if (state === 'warning' && result) {
    const hasRenamedReceivers = result.renamedReceivers.length > 0;
    const hasRenamedTimeIntervals = result.renamedTimeIntervals.length > 0;

    return (
      <Alert
        severity="warning"
        title={t('alerting.import-to-gma.step1.validation-warning', 'Some resources will be renamed')}
      >
        <Stack direction="column" gap={1}>
          <Text>
            <Trans i18nKey="alerting.import-to-gma.step1.validation-warning-desc">
              Some resources will be renamed to avoid conflicts with existing resources.
            </Trans>
          </Text>
          {hasRenamedReceivers && (
            <Text variant="bodySmall" color="secondary">
              {t('alerting.import-to-gma.step1.renamed-receivers', '{{count}} contact points will be renamed', {
                count: result.renamedReceivers.length,
              })}
            </Text>
          )}
          {hasRenamedTimeIntervals && (
            <Text variant="bodySmall" color="secondary">
              {t('alerting.import-to-gma.step1.renamed-intervals', '{{count}} time intervals will be renamed', {
                count: result.renamedTimeIntervals.length,
              })}
            </Text>
          )}
        </Stack>
      </Alert>
    );
  }

  if (state === 'error' && result) {
    return (
      <Alert severity="error" title={t('alerting.import-to-gma.step1.validation-error', 'Validation failed')}>
        <Text>
          {result.error ||
            t('alerting.import-to-gma.step1.validation-error-desc', 'Failed to validate the configuration.')}
        </Text>
      </Alert>
    );
  }

  return null;
}

const getValidationStyles = (theme: GrafanaTheme2) => ({
  statusContainer: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});

/**
 * Hook to check if Step 1 form is valid
 */
export function useStep1Validation(canImport: boolean): boolean {
  const { watch } = useFormContext<ImportFormValues>();
  const [notificationsSource, policyTreeName, notificationsDatasourceUID, notificationsYamlFile] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
  ]);

  return useMemo(() => {
    if (!canImport) {
      return false;
    }
    if (!policyTreeName) {
      return false;
    }
    if (notificationsSource === 'yaml' && !notificationsYamlFile) {
      return false;
    }
    if (notificationsSource === 'datasource' && !notificationsDatasourceUID) {
      return false;
    }
    return true;
  }, [canImport, policyTreeName, notificationsSource, notificationsYamlFile, notificationsDatasourceUID]);
}

/**
 * Component to select an Alertmanager data source (excludes Grafana built-in)
 */
function AlertmanagerDataSourceSelect({ onSelectionChange }: { onSelectionChange?: () => void }) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

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
      label={t('alerting.import-to-gma.step1.datasource', 'Alertmanager data source')}
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
            placeholder={t('alerting.import-to-gma.step1.select-datasource', 'Select data source')}
            width={40}
            noOptionsMessage={t('alerting.import-to-gma.step1.no-datasources', 'No Alertmanager data sources found')}
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
