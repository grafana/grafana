import { kebabCase } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Divider, Field, FileUpload, Input, RadioButtonList, Select, Stack, Text } from '@grafana/ui';

import { getAlertManagerDataSources } from '../../../utils/datasource';
import { ExtraConfigWarning } from '../ExtraConfigWarning';
import { ImportFormValues } from '../ImportToGMA';
import { ValidationStatus } from '../ValidationStatus';
import { getNotificationsSourceOptions } from '../Wizard/constants';
import { DryRunValidationResult } from '../types';

import { hasValidSourceSelection, isStep1Valid, validatePolicyTreeName } from './utils';

interface Step1ContentProps {
  /** Whether the user has permission to import notifications */
  canImport: boolean;
  /** Dry-run validation state */
  dryRunState: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  /** Dry-run validation result */
  dryRunResult?: DryRunValidationResult;
  /** Callback to trigger dry-run validation */
  onTriggerDryRun: () => void;
  /** Identifier of an existing imported config that will be replaced, if any */
  existingIdentifier?: string;
}

/**
 * Step1Content - Content for the notification resources import step
 * This component contains only the form fields, without the header or action buttons
 * The WizardStep wrapper provides those
 */
export function Step1Content({
  canImport,
  dryRunState,
  dryRunResult,
  onTriggerDryRun,
  existingIdentifier,
}: Step1ContentProps) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const [notificationsSource, policyTreeName, notificationsDatasourceUID, notificationsYamlFile] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
  ]);

  // Whether we have enough data to run a dry-run validation
  const canRunDryRun =
    !!policyTreeName &&
    validatePolicyTreeName(policyTreeName) === true &&
    hasValidSourceSelection(notificationsSource, notificationsYamlFile, notificationsDatasourceUID);

  // Trigger dry-run when a source is selected (YAML file or datasource)
  useEffect(() => {
    if (canRunDryRun) {
      onTriggerDryRun();
    }
  }, [canRunDryRun, onTriggerDryRun, notificationsSource, notificationsYamlFile, notificationsDatasourceUID]);

  // Trigger validation + dry-run when the policy tree name input loses focus
  const handlePolicyTreeNameBlur = useCallback(async () => {
    await trigger('policyTreeName'); //force validation onblur
    if (canRunDryRun) {
      onTriggerDryRun();
    }
  }, [trigger, canRunDryRun, onTriggerDryRun]);

  const sourceOptions = getNotificationsSourceOptions();

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

      {/* Extra config overwrite warning */}
      {existingIdentifier && <ExtraConfigWarning existingIdentifier={existingIdentifier} />}

      {/* Import Source Card */}
      <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Box display="flex" alignItems="center" justifyContent="space-between" padding={2}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step1.source-title', 'Import Source')}
          </Text>
        </Box>
        <Divider spacing={0} />
        <Box padding={2}>
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

            {notificationsSource === 'datasource' && <AlertmanagerDataSourceSelect />}
          </Box>
        </Box>
      </Box>

      {/* Policy Tree Name Card */}
      <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Box display="flex" alignItems="center" justifyContent="space-between" padding={2}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step1.policy-tree-title', 'Policy Tree Name')}
          </Text>
        </Box>
        <Divider spacing={0} />
        <Box padding={2}>
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
                {...register('policyTreeName', {
                  required: t('alerting.import-to-gma.step1.policy-tree-required', 'Policy tree name is required'),
                  validate: validatePolicyTreeName,
                  onBlur: handlePolicyTreeNameBlur,
                })}
                placeholder={t('alerting.import-to-gma.step1.policy-tree-placeholder', 'prometheus-prod')}
                width={40}
              />
            </Field>
          </Box>
        </Box>
      </Box>

      {/* Validation Status */}
      {canRunDryRun && dryRunState && dryRunState !== 'idle' && (
        <ValidationStatus state={dryRunState} result={dryRunResult} />
      )}
    </Stack>
  );
}

/**
 * Hook to check if Step 1 form is valid.
 * Checks both that required fields are filled AND that there are no validation errors.
 */
export function useStep1Validation(canImport: boolean): boolean {
  const {
    watch,
    formState: { errors },
  } = useFormContext<ImportFormValues>();
  const [notificationsSource, policyTreeName, notificationsDatasourceUID, notificationsYamlFile] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
  ]);

  const hasStep1Errors =
    !!errors.notificationsSource ||
    !!errors.policyTreeName ||
    !!errors.notificationsDatasourceUID ||
    !!errors.notificationsYamlFile;

  if (!canImport || hasStep1Errors) {
    return false;
  }

  return isStep1Valid({
    policyTreeName,
    notificationsSource,
    notificationsYamlFile,
    notificationsDatasourceUID,
  });
}

/**
 * Component to select an Alertmanager data source (excludes Grafana built-in)
 */
function AlertmanagerDataSourceSelect() {
  const {
    control,
    setValue,
    getValues,
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
                const ds = getAlertManagerDataSources().find((d) => d.uid === selected.value);
                setValue('notificationsDatasourceName', ds?.name ?? null);

                // Auto-populate policy tree name with sanitized datasource name if empty
                const currentPolicyTreeName = getValues('policyTreeName');
                if (!currentPolicyTreeName && ds?.name) {
                  setValue('policyTreeName', kebabCase(ds.name));
                }
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
