import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  type DataSourcesWithValidRecordingTargetByUidResult,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
} from '@grafana/alerting/internal';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Box, Combobox, type ComboboxOption, Divider, Field, RadioButtonList, Stack, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { DataSourceType } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { getRulesSourceOptions } from '../Wizard/steps';
import { useNamespaceGroupOptions } from '../hooks';
import { type ImportFormValues } from '../types';
import { parseYamlFileToRulerRulesConfigDTO } from '../yamlToRulerConverter';

import { YamlFileDropzone, getYamlFileDescription } from './YamlFileDropzone';
import { YamlTargetDataSourceField } from './YamlTargetDataSourceField';

const supportedImportTypes: string[] = [DataSourceType.Prometheus, DataSourceType.Loki];

async function validateRulesYamlFile(file: File | null): Promise<string | true> {
  if (!file) {
    return t('alerting.import-to-gma.step2.yaml-required', 'Please select a file');
  }
  let rules: RulerCloudRulesConfigDTO;
  try {
    rules = await parseYamlFileToRulerRulesConfigDTO(file, file.name);
  } catch (error) {
    return t('alerting.import-to-gma.step2.yaml-error', 'Failed to parse YAML file: {{error}}', {
      error: stringifyErrorLike(error),
    });
  }
  const groups = Object.values(rules).flat();
  // The import accepts a file without rules and then imports nothing. A group without rules replaces
  // the rules already in that group, so a single one is enough to reject the file.
  if (groups.length === 0 || groups.every((group) => group.rules.length === 0)) {
    return t('alerting.import-to-gma.step2.yaml-no-rules', 'No rules found in this file');
  }
  const emptyGroup = groups.find((group) => group.rules.length === 0);
  return emptyGroup
    ? t('alerting.import-to-gma.step2.yaml-empty-group', 'The group "{{group}}" has no rules', {
        group: emptyGroup.name,
      })
    : true;
}

interface ImportSourceCardProps {
  recordingTargets: DataSourcesWithValidRecordingTargetByUidResult;
}

/** Where the rules come from: a data source, with optional namespace and group filters, or a YAML file. */
export function ImportSourceCard({ recordingTargets }: ImportSourceCardProps) {
  const {
    control,
    watch,
    setValue,
    getValues,
    trigger,
    clearErrors,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  const [rulesSource, rulesDatasourceUID, rulesDatasourceName, rulesYamlFile, namespace] = watch([
    'rulesSource',
    'rulesDatasourceUID',
    'rulesDatasourceName',
    'rulesYamlFile',
    'namespace',
  ]);

  const { namespaceOptions, groupOptions, isLoadingNamespaces } = useNamespaceGroupOptions(
    rulesSource,
    rulesDatasourceName,
    namespace
  );

  // Reset namespace/group if datasource changes
  useEffect(() => {
    setValue('namespace', undefined);
    setValue('ruleGroup', undefined);
  }, [rulesDatasourceName, setValue]);

  const rulesSourceOptions = getRulesSourceOptions();

  const handleSourceChange = (value: ImportFormValues['rulesSource']) => {
    setValue('rulesSource', value);
    if (value === 'datasource') {
      setValue('rulesYamlFile', null);
    } else {
      setValue('namespace', undefined);
      setValue('ruleGroup', undefined);
    }
    clearErrors('rulesYamlFile');
    clearErrors('rulesDatasourceUID');
  };

  // Clearing lets the user back out of this step. A recording rules target that was only filled in from this
  // data source goes with it.
  const handleDatasourceClear = (currentUID: string | undefined, onChange: (uid: undefined) => void) => {
    if (getValues('targetDatasourceUID') === currentUID) {
      setValue('targetDatasourceUID', undefined);
    }
    onChange(undefined);
    setValue('rulesDatasourceName', null);
  };

  const handleDatasourceChange = (ds: DataSourceInstanceSettings, onChange: (uid: string) => void) => {
    onChange(ds.uid);
    setValue('rulesDatasourceName', ds.name);
    if (!getValues('targetDatasourceUID') && recordingTargets.byUid.has(ds.uid)) {
      setValue('targetDatasourceUID', ds.uid);
    }
  };

  const handleNamespaceChange = (option: ComboboxOption<string> | null, onChange: (value?: string) => void) => {
    setValue('ruleGroup', undefined);
    onChange(option?.value);
  };

  const handleGroupChange = (option: ComboboxOption<string> | null) => {
    setValue('ruleGroup', option?.value);
  };

  // Check a new file right away. Removing it just empties the step, which isn't an error.
  const handleYamlFileChange = (file: File | null, onChange: (file: File | null) => void) => {
    onChange(file);
    if (file) {
      trigger('rulesYamlFile');
    } else {
      clearErrors('rulesYamlFile');
    }
  };

  return (
    <Box backgroundColor="secondary" borderRadius="default" borderColor="weak" borderStyle="solid">
      <Box display="flex" alignItems="center" justifyContent="space-between" padding={2}>
        <Text variant="h5" element="h3">
          {t('alerting.import-to-gma.step2.source-title', 'Import source')}
        </Text>
      </Box>
      <Divider spacing={0} />
      <Box padding={2}>
        <Field noMargin>
          <Controller
            render={({ field: { onChange, ref, ...field } }) => (
              <RadioButtonList {...field} onChange={handleSourceChange} options={rulesSourceOptions} />
            )}
            control={control}
            name="rulesSource"
          />
        </Field>

        <Box marginTop={2}>
          {rulesSource === 'datasource' && (
            <Stack direction="column" gap={2}>
              <Field
                label={t('alerting.import-to-gma.step2.datasource', 'Data source')}
                invalid={!!errors.rulesDatasourceUID}
                error={errors.rulesDatasourceUID?.message}
                noMargin
              >
                <Controller
                  render={({ field: { ref, onChange, ...field } }) => (
                    <DataSourcePicker
                      {...field}
                      alerting
                      disabled={recordingTargets.isLoading}
                      filter={(ds) =>
                        isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type) &&
                        supportedImportTypes.includes(ds.type)
                      }
                      current={field.value}
                      onClear={() => handleDatasourceClear(field.value, onChange)}
                      onChange={(ds) => handleDatasourceChange(ds, onChange)}
                      noDefault
                      width={40}
                    />
                  )}
                  control={control}
                  name="rulesDatasourceUID"
                />
              </Field>

              {/* Namespace and Group Filter */}
              {rulesDatasourceUID && (
                <Stack direction="row" gap={2}>
                  <Field
                    label={t('alerting.import-to-gma.step2.namespace', 'Namespace')}
                    description={t('alerting.import-to-gma.step2.namespace-desc', 'Filter by namespace (optional)')}
                    noMargin
                  >
                    <Controller
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Combobox
                          {...field}
                          onChange={(option) => handleNamespaceChange(option, onChange)}
                          placeholder={t('alerting.import-to-gma.step2.select-namespace', 'All namespaces')}
                          options={namespaceOptions}
                          width={30}
                          loading={isLoadingNamespaces}
                          disabled={isLoadingNamespaces || !rulesDatasourceName}
                          isClearable
                          data-testid={selectors.pages.Alerting.ImportToGMA.namespaceInput}
                        />
                      )}
                      name="namespace"
                      control={control}
                    />
                  </Field>
                  <Field
                    label={t('alerting.import-to-gma.step2.group', 'Group')}
                    description={t('alerting.import-to-gma.step2.group-desc', 'Filter by group (optional)')}
                    noMargin
                  >
                    <Controller
                      render={({ field: { ref, ...field } }) => (
                        <Combobox
                          {...field}
                          options={groupOptions}
                          width={30}
                          onChange={handleGroupChange}
                          placeholder={t('alerting.import-to-gma.step2.select-group', 'All groups')}
                          loading={isLoadingNamespaces}
                          disabled={isLoadingNamespaces || !namespace || !rulesDatasourceName}
                          isClearable
                          data-testid={selectors.pages.Alerting.ImportToGMA.groupInput}
                        />
                      )}
                      name="ruleGroup"
                      control={control}
                    />
                  </Field>
                </Stack>
              )}
            </Stack>
          )}

          {rulesSource === 'yaml' && (
            <Stack direction="column" gap={2}>
              <Field
                label={t('alerting.import-to-gma.step2.yaml-file', 'Rules YAML file')}
                description={getYamlFileDescription()}
                invalid={!!errors.rulesYamlFile}
                error={errors.rulesYamlFile?.message}
                noMargin
              >
                <Controller
                  render={({ field: { onChange } }) => (
                    <YamlFileDropzone file={rulesYamlFile} onChange={(file) => handleYamlFileChange(file, onChange)} />
                  )}
                  control={control}
                  name="rulesYamlFile"
                  rules={{
                    required: {
                      value: true,
                      message: t('alerting.import-to-gma.step2.yaml-required', 'Please select a file'),
                    },
                    validate: validateRulesYamlFile,
                  }}
                />
              </Field>
              <YamlTargetDataSourceField recordingTargets={recordingTargets} />
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
