import { useState } from 'react';
import { Controller, FormProvider, SubmitHandler, useForm, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  Box,
  Button,
  Collapse,
  Divider,
  Field,
  FileUpload,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  LinkButton,
  RadioButtonList,
  Spinner,
  Stack,
  Text,
} from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { Folder } from '../../types/rule-form';
import {
  DataSourceType,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isValidRecordingRulesTarget,
} from '../../utils/datasource';
import { stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { CreateNewFolder } from '../create-folder/CreateNewFolder';
import { CloudRulesSourcePicker } from '../rule-editor/CloudRulesSourcePicker';
import { NeedHelpInfo } from '../rule-editor/NeedHelpInfo';

import { ConfirmConversionModal } from './ConfirmConvertModal';
import { NamespaceAndGroupFilter } from './NamespaceAndGroupFilter';
import { parseYamlFileToRulerRulesConfigDTO } from './yamlToRulerConverter';

export interface ImportFormValues {
  importSource: 'datasource' | 'yaml';
  yamlFile: File | null;
  yamlImportTargetDatasourceUID?: string;
  selectedDatasourceUID?: string;
  selectedDatasourceName: string | null;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  targetFolder?: Folder;
  namespace?: string;
  ruleGroup?: string;
  targetDatasourceUID?: string;
}

export const supportedImportTypes: string[] = [DataSourceType.Prometheus, DataSourceType.Loki];

const ImportToGMARules = () => {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      importSource: 'datasource',
      yamlFile: null,
      yamlImportTargetDatasourceUID: undefined,
      selectedDatasourceUID: undefined,
      selectedDatasourceName: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetFolder: undefined,
      targetDatasourceUID: undefined,
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = formAPI;

  const [optionsShowing, toggleOptions] = useToggle(true);
  const [selectedDatasourceName, importSource] = watch(['selectedDatasourceName', 'importSource']);

  const [formImportPayload, setFormImportPayload] = useState<ImportFormValues | null>(null);
  const isImportYamlEnabled = config.featureToggles.alertingImportYAMLUI;

  const onSubmit: SubmitHandler<ImportFormValues> = async (formData) => {
    setFormImportPayload(formData);
  };

  const importSourceOptions: Array<{ label: string; description: string; value: 'datasource' | 'yaml' }> = [
    {
      label: t('alerting.import-to-gma.source.datasource', 'Existing data source-managed rules'),
      description: t('alerting.import-to-gma.source.datasource-description', 'Import rules from existing data sources'),
      value: 'datasource',
    },
  ];

  if (isImportYamlEnabled) {
    importSourceOptions.push({
      label: t('alerting.import-to-gma.source.yaml', 'Prometheus YAML file'),
      description: t('alerting.import-to-gma.source.yaml-description', 'Import rules from a Prometheus YAML file.'),
      value: 'yaml',
    });
  }

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: t('alerting.import-to-gma.pageTitle', 'Import alert rules'),
      }}
    >
      <Stack gap={2} direction={'column'}>
        <FormProvider {...formAPI}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack direction="column" gap={1}>
              <Field
                label={t('alerting.import-to-gma.import-source', 'Import source')}
                invalid={!!errors.importSource}
                error={errors.importSource?.message}
                htmlFor="import-source"
                noMargin
              >
                <Controller
                  render={({ field: { onChange, ref, ...field } }) => (
                    <RadioButtonList
                      {...field}
                      onChange={(value) => setValue('importSource', value)}
                      options={importSourceOptions}
                    />
                  )}
                  control={control}
                  name="importSource"
                />
              </Field>

              {importSource === 'datasource' && <DataSourceField />}

              {isImportYamlEnabled && importSource === 'yaml' && (
                <>
                  <YamlFileUpload />
                  <YamlTargetDataSourceField />
                </>
              )}
              {/* Optional settings */}
              <Collapse
                label={t('alerting.import-to-gma.additional-settings', 'Additional settings')}
                isOpen={optionsShowing}
                onToggle={toggleOptions}
                collapsible={true}
              >
                <Box marginLeft={1}>
                  <Box marginBottom={2}>
                    <Text variant="h5">
                      {t('alerting.import-to-gma.import-location-and-filters', 'Import location and filters')}
                    </Text>
                  </Box>

                  <Stack direction="column" gap={2}>
                    <TargetFolderField />
                    {importSource === 'datasource' && (
                      <NamespaceAndGroupFilter rulesSourceName={selectedDatasourceName || undefined} />
                    )}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Box marginLeft={1} marginBottom={1}>
                    <Text variant="h5">{t('alerting.import-to-gma.alert-rules', 'Alert rules')}</Text>
                  </Box>

                  <InlineField
                    transparent={true}
                    label={t('alerting.import-to-gma.pause.label', 'Pause imported alerting rules')}
                    labelWidth={30}
                    htmlFor="pause-alerting-rules"
                  >
                    <InlineSwitch
                      transparent
                      id="pause-alerting-rules"
                      {...register('pauseAlertingRules')}
                      showLabel={false}
                    />
                  </InlineField>
                </Box>

                <Divider />

                <Box>
                  <Box marginBottom={1} marginLeft={1}>
                    <Text variant="h5">{t('alerting.import-to-gma.recording-rules', 'Recording rules')}</Text>
                  </Box>

                  <InlineFieldRow>
                    <InlineField
                      transparent={true}
                      label={t('alerting.import-to-gma.pause-recording.label', 'Pause imported recording rules')}
                      labelWidth={30}
                      htmlFor="pause-recording-rules"
                    >
                      <InlineSwitch transparent id="pause-recording-rules" {...register('pauseRecordingRules')} />
                    </InlineField>
                  </InlineFieldRow>

                  <Box marginLeft={1} width={50}>
                    <TargetDataSourceForRecordingRulesField />
                  </Box>
                </Box>
              </Collapse>
            </Stack>

            <Box marginTop={2}>
              <Stack gap={1}>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  <Stack direction="row" gap={2} alignItems="center">
                    {isSubmitting && <Spinner inline={true} />}
                    <Trans i18nKey="alerting.import-to-gma.action-button">Import</Trans>
                  </Stack>
                </Button>

                <LinkButton variant="secondary" href="/alerting/list">
                  <Trans i18nKey="common.cancel">Cancel</Trans>
                </LinkButton>
              </Stack>
            </Box>
            {formImportPayload && (
              <ConfirmConversionModal
                isOpen={!!formImportPayload}
                onDismiss={() => setFormImportPayload(null)}
                importPayload={formImportPayload}
              />
            )}
          </form>
        </FormProvider>
      </Stack>
    </AlertingPageWrapper>
  );
};

function YamlFileUpload() {
  const {
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      label={t('alerting.import-to-gma.yaml.label', 'Prometheus YAML file')}
      invalid={!!errors.yamlFile}
      error={errors.yamlFile?.message}
      description={t('alerting.import-to-gma.yaml.description', 'Select a Prometheus-compatible YAML file to import')}
      noMargin
    >
      <Controller<ImportFormValues, 'yamlFile'>
        name="yamlFile"
        render={({ field: { onChange, ref, ...field } }) => (
          <FileUpload
            {...field}
            onFileUpload={(event) => {
              const yamlFile = event.currentTarget.files?.item(0);
              onChange(yamlFile);
              // Crucial for allowing re-selection of the same file after external edits
              event.currentTarget.value = '';
            }}
            size="sm"
            showFileName
            accept=".yaml,.yml,.json"
          />
        )}
        rules={{
          required: {
            value: true,
            message: t('alerting.import-to-gma.yaml.required-message', 'Please select a file'),
          },
          validate: async (value) => {
            if (!value) {
              return t('alerting.import-to-gma.yaml.required-message', 'Please select a file');
            }
            try {
              await parseYamlFileToRulerRulesConfigDTO(value, value.name);
              return true;
            } catch (error) {
              return t('alerting.import-to-gma.yaml-error', 'Failed to parse YAML file: {{error}}', {
                error: stringifyErrorLike(error),
              });
            }
          },
        }}
      />
    </Field>
  );
}

function YamlTargetDataSourceField() {
  const {
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      label={t('alerting.import-to-gma.yaml.target-datasource', 'Target data source')}
      description={t(
        'alerting.import-to-gma.yaml.target-datasource-description',
        'Select the data source that will be queried by the imported rules. Make sure metrics used in the imported rules are available in this data source.'
      )}
      invalid={!!errors.yamlImportTargetDatasourceUID}
      error={errors.yamlImportTargetDatasourceUID?.message}
      htmlFor="yaml-target-data-source"
      noMargin
    >
      <Controller<ImportFormValues, 'yamlImportTargetDatasourceUID'>
        name="yamlImportTargetDatasourceUID"
        render={({ field: { onChange, ref, value, ...field } }) => (
          <DataSourcePicker
            {...field}
            current={value}
            noDefault
            inputId="yaml-target-data-source"
            alerting
            filter={(ds: DataSourceInstanceSettings) => isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type)}
            onChange={(ds: DataSourceInstanceSettings) => {
              setValue('yamlImportTargetDatasourceUID', ds.uid);
              const recordingRulesTargetDs = getValues('targetDatasourceUID');
              if (!recordingRulesTargetDs && isValidRecordingRulesTarget(ds)) {
                setValue('targetDatasourceUID', ds.uid);
              }
            }}
          />
        )}
        rules={{
          required: {
            value: true,
            message: t('alerting.import-to-gma.yaml.target-datasource-required', 'Please select a target data source'),
          },
        }}
      />
    </Field>
  );
}

function TargetDataSourceForRecordingRulesField() {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      required
      label={t('alerting.recording-rules.label-target-data-source', 'Target data source')}
      description={t(
        'alerting.recording-rules.description-target-data-source',
        'The Prometheus data source to store recording rules in'
      )}
      htmlFor="recording-rules-target-data-source"
      error={errors.targetDatasourceUID?.message}
      invalid={!!errors.targetDatasourceUID?.message}
      noMargin
    >
      <Controller<ImportFormValues, 'targetDatasourceUID'>
        render={({ field: { onChange, ref, ...field } }) => (
          <DataSourcePicker
            {...field}
            current={field.value}
            inputId="recording-rules-target-data-source"
            noDefault
            filter={isValidRecordingRulesTarget}
            onChange={(ds: DataSourceInstanceSettings) => {
              setValue('targetDatasourceUID', ds.uid);
            }}
          />
        )}
        name="targetDatasourceUID"
        control={control}
        rules={{
          required: {
            value: true,
            message: t('alerting.recording-rules.target-data-source-required', 'Please select a target data source'),
          },
        }}
      />
    </Field>
  );
}

function TargetFolderField() {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      label={t('alerting.import-to-gma.target-folder.label', 'Target folder')}
      description={t('alerting.import-to-gma.target-folder.description', 'The folder to import the rules to')}
      error={errors.targetFolder?.message}
      htmlFor="folder-picker"
      noMargin
    >
      <Stack gap={2}>
        <Controller<ImportFormValues, 'targetFolder'>
          name="targetFolder"
          render={({ field: { onChange, ref, ...field } }) => (
            <Stack width={42}>
              <NestedFolderPicker
                permission="view"
                showRootFolder={false}
                invalid={!!errors.targetFolder?.message}
                {...field}
                value={field.value?.uid}
                onChange={(uid, title) => {
                  if (uid && title) {
                    setValue('targetFolder', { title, uid });
                  } else {
                    setValue('targetFolder', undefined);
                  }
                }}
              />
            </Stack>
          )}
          control={control}
        />
        <CreateNewFolder
          onCreate={(folder) => {
            setValue('targetFolder', folder);
          }}
        />
      </Stack>
    </Field>
  );
}

function DataSourceField() {
  const {
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      label={
        <Stack direction="row" gap={1}>
          <Text variant="bodySmall" color="secondary">
            {t('alerting.import-to-gma.datasource.label', 'Data source')}
          </Text>
          <NeedHelpInfo
            externalLink={'https://grafana.com/docs/grafana/latest/alerting/alerting-rules/alerting-migration/'}
            linkText={`Read importing to Grafana alerting`}
            contentText={t(
              'alerting.import-to-gma.datasource.help-info.content',
              'The dropdown only displays Mimir or Loki data sources that have the ruler API available.'
            )}
            title={t('alerting.import-to-gma.datasource.help-info.title', 'Data source')}
          />
        </Stack>
      }
      invalid={!!errors.selectedDatasourceName}
      error={errors.selectedDatasourceName?.message}
      htmlFor="datasource-picker"
      noMargin
    >
      <Controller<ImportFormValues, 'selectedDatasourceName'>
        name="selectedDatasourceName"
        render={({ field: { onChange, ref, ...field } }) => (
          <CloudRulesSourcePicker
            {...field}
            width={50}
            inputId="datasource-picker"
            onChange={(ds: DataSourceInstanceSettings) => {
              setValue('selectedDatasourceUID', ds.uid);
              setValue('selectedDatasourceName', ds.name);

              // If we've chosen a Prometheus data source, we can set the recording rules target data source to the same as the source
              const recordingRulesTargetDs = getValues('targetDatasourceUID');
              if (!recordingRulesTargetDs) {
                const targetDataSourceUID = isValidRecordingRulesTarget(ds) ? ds.uid : undefined;
                setValue('targetDatasourceUID', targetDataSourceUID);
              }
            }}
          />
        )}
        control={control}
        rules={{
          required: {
            value: true,
            message: t('alerting.import-to-gma.datasource.required-message', 'Please select a data source'),
          },
        }}
      />
    </Field>
  );
}

export default withPageErrorBoundary(ImportToGMARules);
