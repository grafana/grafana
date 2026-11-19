import { kebabCase } from 'lodash';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { type AlertManagerDataSourceJsonData } from '@grafana/alerting/internal';
import { type DataSourceSettings, OrgRole, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Alert,
  Box,
  Divider,
  Field,
  InlineField,
  InlineSwitch,
  RadioButtonList,
  Select,
  Stack,
  Text,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';

import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import {
  AlertmanagerDataSourceOption,
  useAlertmanagerDataSourceOptions,
} from '../../settings/AlertmanagerDataSourceOptions';
import { PolicyTreeNameHelp } from '../PolicyTreeNameHelp';
import { ValidationStatus } from '../ValidationStatus';
import { getNotificationsSourceOptions, isAutoSyncSelected } from '../Wizard/steps';
import { type DryRunState, type DryRunValidationResult, type ImportFormValues } from '../types';

import { PolicyTreeNameField } from './PolicyTreeNameField';
import { TemplateFilesField } from './TemplateFilesField';
import { YamlFileDropzone, getYamlFileDescription } from './YamlFileDropzone';
import { useAutoSyncPrediction } from './useAutoSyncPrediction';
import { useStep1Form } from './useStep1Form';
import { isStep1Valid } from './utils';

/** Whether the Auto-sync checkbox may be offered: requires the sync toggle and Org Admin. */
function isAutoSyncSegmentEnabled(): boolean {
  return Boolean(config.featureToggles['alerting.syncExternalAlertmanager']) && contextSrv.hasRole(OrgRole.Admin);
}

/** Explains why the Auto-sync switch is disabled, or the normal hint when it isn't. */
function getAutoSyncTooltip({
  isAutoSyncConfigReady,
  autoSyncNotReadyMessage,
  isSelectedDatasourceAutoSyncCapable,
}: {
  isAutoSyncConfigReady: boolean;
  autoSyncNotReadyMessage: string | undefined;
  isSelectedDatasourceAutoSyncCapable: boolean;
}): string | undefined {
  if (!isAutoSyncConfigReady) {
    return autoSyncNotReadyMessage;
  }
  if (isSelectedDatasourceAutoSyncCapable) {
    return t(
      'alerting.import-to-gma.step1.autosync-tooltip',
      'Continuously sync alert configuration from this data source instead of importing once. Alert rules are not synced automatically — import them separately in the next step if needed.'
    );
  }
  return t(
    'alerting.import-to-gma.step1.autosync-tooltip-unsupported',
    "Auto-sync isn't available for this Alertmanager type. Select a Mimir or Cortex data source to enable it."
  );
}

interface Step1ContentProps {
  /** Whether the user has permission to import notifications */
  canImport: boolean;
  /** Dry-run validation state */
  dryRunState: DryRunState;
  /** Dry-run validation result */
  dryRunResult?: DryRunValidationResult;
}

/**
 * Step1Content - Content for the notification configuration import step
 * This component contains only the form fields, without the header or action buttons
 * The WizardStep wrapper provides those
 */
export function Step1Content({ canImport, dryRunState, dryRunResult }: Step1ContentProps) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const notifyApp = useAppNotification();
  const [notificationsSource, notificationsYamlFile] = watch(['notificationsSource', 'notificationsYamlFile']);

  const {
    autoSyncActive,
    autoSyncEligibleAlertmanagers,
    isAutoSyncConfigReady,
    autoSyncNotReadyMessage,
    isSelectedDatasourceAutoSyncCapable,
    autoSyncIdentifier,
    autoSyncConflictMessage,
    duplicateTemplateFileName,
    validatePolicyTreeNameIsFree,
    handlePolicyTreeNameBlur,
  } = useStep1Form();

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
            You do not have permission to import notification configuration. You need the{' '}
            <strong>alerting.notifications:write</strong> permission. You can skip this step.
          </Trans>
        </Alert>
      )}

      {/* Import Source Card */}
      <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
        <Box display="flex" alignItems="center" justifyContent="space-between" padding={2}>
          <Text variant="h5" element="h3">
            {t('alerting.import-to-gma.step1.source-title', 'Import source')}
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
                  description={getYamlFileDescription()}
                  invalid={Boolean(errors.notificationsYamlFile)}
                  error={errors.notificationsYamlFile?.message}
                  noMargin
                >
                  <Controller
                    render={({ field: { onChange } }) => (
                      <YamlFileDropzone
                        file={notificationsYamlFile}
                        onChange={onChange}
                        onUploaded={(file) =>
                          notifyApp.success(
                            t('alerting.import-to-gma.step1.yaml-added-title', 'Configuration file uploaded'),
                            file.name
                          )
                        }
                      />
                    )}
                    control={control}
                    name="notificationsYamlFile"
                  />
                </Field>

                <TemplateFilesField duplicateFileName={duplicateTemplateFileName} />
              </Stack>
            )}

            {notificationsSource === 'datasource' && (
              <Stack direction="column" gap={2}>
                <AlertmanagerDataSourceSelect autoSyncEligibleAlertmanagers={autoSyncEligibleAlertmanagers} />
                {isAutoSyncSegmentEnabled() && (
                  <InlineField
                    transparent
                    label={t('alerting.import-to-gma.step1.autosync-label', 'Auto-sync')}
                    labelWidth={30}
                    disabled={!isAutoSyncConfigReady || !isSelectedDatasourceAutoSyncCapable}
                    tooltip={getAutoSyncTooltip({
                      isAutoSyncConfigReady,
                      autoSyncNotReadyMessage,
                      isSelectedDatasourceAutoSyncCapable,
                    })}
                  >
                    <InlineSwitch
                      transparent
                      id="autosync-notifications-enabled"
                      {...register('autoSyncNotificationsEnabled')}
                    />
                  </InlineField>
                )}
              </Stack>
            )}

            {/* Shown with the source it describes, as soon as one is chosen. */}
            {dryRunState !== 'idle' && (
              <Box marginTop={2}>
                <ValidationStatus state={dryRunState} result={dryRunResult} />
              </Box>
            )}
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
            <PolicyTreeNameField
              autoSyncActive={autoSyncActive}
              autoSyncIdentifier={autoSyncIdentifier}
              autoSyncConflictMessage={autoSyncConflictMessage}
              validate={validatePolicyTreeNameIsFree}
              onBlur={handlePolicyTreeNameBlur}
            />
          </Box>
        </Box>
      </Box>
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
    autoSyncNotificationsEnabled,
    notificationsDatasourceName,
  ] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
    'autoSyncNotificationsEnabled',
    'notificationsDatasourceName',
  ]);

  // The sync fails on a taken name, so Next stays blocked until it is renamed.
  const autoSyncPrediction = useAutoSyncPrediction(
    isAutoSyncSelected(autoSyncNotificationsEnabled ?? false, notificationsSource),
    notificationsDatasourceUID,
    notificationsDatasourceName
  );

  const hasStep1Errors =
    Boolean(autoSyncPrediction?.conflict) ||
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
    autoSyncNotificationsEnabled: autoSyncNotificationsEnabled ?? false,
  });
}

interface AlertmanagerDataSourceSelectProps {
  /** Used to badge options that support Auto-sync. */
  autoSyncEligibleAlertmanagers: Array<DataSourceSettings<AlertManagerDataSourceJsonData>>;
}

/** Every Alertmanager data source (same source as AlertManagerPicker), badging the ones Auto-sync can mirror. */
function AlertmanagerDataSourceSelect({ autoSyncEligibleAlertmanagers }: AlertmanagerDataSourceSelectProps) {
  // Only annotate options for users who can ever see the Auto-sync segment at all — otherwise the
  // badge would be noise with no checkbox to explain it. No separate loading guard is needed here:
  // while the Mimir/Cortex query is in flight, autoSyncEligibleAlertmanagers is empty, so nothing gets
  // badged yet regardless.
  const shouldAnnotateAutoSync = isAutoSyncSegmentEnabled();

  const alertmanagerOptions = useAlertmanagerDataSourceOptions(autoSyncEligibleAlertmanagers, {
    annotateAutoSync: shouldAnnotateAutoSync,
  });

  // A plain Prometheus Alertmanager has no config endpoint. It only shares its configuration through its
  // status page, with every credential replaced by "<secret>", so importing from it would leave contact
  // points that can't send. Its YAML file has the real values.
  const options = useMemo(
    () =>
      alertmanagerOptions.map((option) =>
        typeof option.label === 'string' && isVanillaPrometheusAlertManagerDataSource(option.label)
          ? {
              ...option,
              isDisabled: true,
              description: t(
                'alerting.import-to-gma.step1.datasource-prometheus-unsupported',
                "Doesn't share its full configuration. Upload its YAML file instead."
              ),
            }
          : option
      ),
    [alertmanagerOptions]
  );

  return (
    <DataSourceSelectField
      options={options}
      noOptionsMessage={t('alerting.import-to-gma.step1.no-datasources', 'No Alertmanager data sources found')}
    />
  );
}

interface DataSourceSelectFieldProps {
  options: Array<SelectableValue<string>>;
  noOptionsMessage: string;
}

/** Select + autofill logic for the Alertmanager data source picker. */
function DataSourceSelectField({ options, noOptionsMessage }: DataSourceSelectFieldProps) {
  const {
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  // Cleared, which lets the user back out of this step. A policy tree name that was only filled in from this
  // datasource goes with it, so the step can read as empty again.
  const handleClear = (onChange: (value: undefined) => void) => {
    const previousName = getValues('notificationsDatasourceName');
    if (previousName && getValues('policyTreeName') === kebabCase(previousName)) {
      setValue('policyTreeName', '');
    }
    onChange(undefined);
    setValue('notificationsDatasourceName', null);
  };

  const handleSelect = (uid: string, onChange: (value: string) => void) => {
    onChange(uid);
    const ds = options.find((o) => o.value === uid);
    const dsName = typeof ds?.label === 'string' ? ds.label : undefined;
    setValue('notificationsDatasourceName', dsName ?? null);

    if (!getValues('policyTreeName') && dsName) {
      setValue('policyTreeName', kebabCase(dsName));
    }
  };

  return (
    <Field
      label={t('alerting.import-to-gma.step1.datasource', 'Alertmanager data source')}
      invalid={!!errors.notificationsDatasourceUID}
      error={errors.notificationsDatasourceUID?.message}
      noMargin
      data-testid={selectors.pages.Alerting.ImportToGMA.alertmanagerDataSourceField}
    >
      <Controller
        render={({ field: { ref, onChange, ...field } }) => (
          <Select
            {...field}
            options={options}
            onChange={(selected) => (selected?.value ? handleSelect(selected.value, onChange) : handleClear(onChange))}
            isClearable
            placeholder={t('alerting.import-to-gma.step1.select-datasource', 'Select data source')}
            width={40}
            noOptionsMessage={noOptionsMessage}
            components={{ Option: AlertmanagerDataSourceOption }}
          />
        )}
        control={control}
        name="notificationsDatasourceUID"
      />
    </Field>
  );
}
