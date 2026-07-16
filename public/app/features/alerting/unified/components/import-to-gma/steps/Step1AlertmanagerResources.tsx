import { kebabCase } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Divider,
  Field,
  FileDropzone,
  FileUpload,
  IconButton,
  Input,
  RadioButtonList,
  Select,
  Stack,
  Text,
} from '@grafana/ui';

import { getAlertManagerDataSources } from '../../../utils/datasource';
import { type ImportFormValues } from '../ImportToGMA';
import { PolicyTreeNameHelp } from '../PolicyTreeNameHelp';
import { ValidationStatus } from '../ValidationStatus';
import { getNotificationsSourceOptions } from '../Wizard/steps';
import { type DryRunValidationResult } from '../types';

import { findDuplicateTemplateFileName, hasValidSourceSelection, isStep1Valid, validatePolicyTreeName } from './utils';

interface Step1ContentProps {
  /** Whether the user has permission to import notifications */
  canImport: boolean;
  /** Dry-run validation state */
  dryRunState: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  /** Dry-run validation result */
  dryRunResult?: DryRunValidationResult;
  /** Callback to trigger dry-run validation */
  onTriggerDryRun: () => void;
  /** Callback to clear a stale dry-run result when the step is no longer runnable */
  onResetDryRun: () => void;
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
  onResetDryRun,
}: Step1ContentProps) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const [
    notificationsSource,
    policyTreeName,
    notificationsDatasourceUID,
    notificationsYamlFile,
    notificationsTemplateFiles,
  ] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
  ]);

  const duplicateTemplateFileName = findDuplicateTemplateFileName(notificationsTemplateFiles);

  // Whether we have enough data to run a dry-run validation
  const canRunDryRun =
    Boolean(policyTreeName) &&
    validatePolicyTreeName(policyTreeName) === true &&
    !duplicateTemplateFileName &&
    hasValidSourceSelection(notificationsSource, notificationsYamlFile, notificationsDatasourceUID);

  // Trigger dry-run when a source is selected (YAML file or datasource) or the template files change.
  // When the step is no longer runnable (e.g. a duplicate template name), clear any previous result so
  // a stale success can't keep the review step reporting the config as ready to import.
  useEffect(() => {
    if (canRunDryRun) {
      onTriggerDryRun();
    } else {
      onResetDryRun();
    }
  }, [
    canRunDryRun,
    onTriggerDryRun,
    onResetDryRun,
    notificationsSource,
    notificationsYamlFile,
    notificationsDatasourceUID,
    notificationsTemplateFiles,
  ]);

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
                  onChange={(value) => {
                    setValue('notificationsSource', value);
                    // Template uploads only apply to the YAML source; clear them when switching source
                    setValue('notificationsTemplateFiles', []);
                  }}
                  options={sourceOptions}
                />
              )}
              control={control}
              name="notificationsSource"
            />
          </Field>

          <Box marginTop={2}>
            {notificationsSource === 'yaml' && (
              <Stack direction="column" gap={2}>
                <Field
                  label={t('alerting.import-to-gma.step1.yaml-file', 'Alertmanager config YAML')}
                  invalid={Boolean(errors.notificationsYamlFile)}
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

                <Field
                  label={t('alerting.import-to-gma.step1.templates-label', 'Notification templates')}
                  description={t(
                    'alerting.import-to-gma.step1.templates-desc',
                    'Optional. Upload the template files referenced by your Alertmanager config. Each file is imported as a template named after the file.'
                  )}
                  invalid={Boolean(duplicateTemplateFileName)}
                  error={
                    duplicateTemplateFileName
                      ? t(
                          'alerting.import-to-gma.step1.templates-duplicate',
                          'Duplicate template file name: "{{name}}". Template file names must be unique.',
                          { name: duplicateTemplateFileName }
                        )
                      : undefined
                  }
                  noMargin
                >
                  <Controller
                    render={({ field: { value, onChange } }) => (
                      <Stack direction="column" gap={1}>
                        <FileDropzone
                          // Template files can have any name/extension (mimirtool loads arbitrary *.tpl);
                          // the file name becomes the template key, so we don't restrict by extension.
                          options={{
                            multiple: true,
                            onDrop: (acceptedFiles) => onChange([...value, ...acceptedFiles]),
                          }}
                          fileListRenderer={() => null}
                        >
                          <Text color="secondary">
                            {t(
                              'alerting.import-to-gma.step1.templates-dropzone',
                              'Drop template files here or click to upload'
                            )}
                          </Text>
                        </FileDropzone>

                        {value.map((file, index) => (
                          <Stack
                            key={`${file.name}-${index}`}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Text>{file.name}</Text>
                            <IconButton
                              name="trash-alt"
                              tooltip={t('alerting.import-to-gma.step1.templates-remove', 'Remove {{name}}', {
                                name: file.name,
                              })}
                              onClick={() => onChange(value.filter((_, fileIndex) => fileIndex !== index))}
                            />
                          </Stack>
                        ))}
                      </Stack>
                    )}
                    control={control}
                    name="notificationsTemplateFiles"
                  />
                </Field>
              </Stack>
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
          <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.import-to-gma.step1.policy-tree-desc">
                When you import, Grafana creates a separate notification policy tree. Enter a name you will recognize.
              </Trans>
            </Text>
            <PolicyTreeNameHelp />
          </Stack>
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
  const [
    notificationsSource,
    policyTreeName,
    notificationsDatasourceUID,
    notificationsYamlFile,
    notificationsTemplateFiles,
  ] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
  ]);

  const hasStep1Errors =
    Boolean(errors.notificationsSource) ||
    Boolean(errors.policyTreeName) ||
    Boolean(errors.notificationsDatasourceUID) ||
    Boolean(errors.notificationsYamlFile);

  if (!canImport || hasStep1Errors) {
    return false;
  }

  return isStep1Valid({
    policyTreeName,
    notificationsSource,
    notificationsYamlFile,
    notificationsDatasourceUID,
    notificationsTemplateFiles,
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
