import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import {
  Box,
  Button,
  Collapse,
  Divider,
  Field,
  InlineField,
  InlineSwitch,
  LinkButton,
  Spinner,
  Stack,
  Text,
} from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { Trans, t } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { Folder } from '../../types/rule-form';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { CloudRulesSourcePicker } from '../rule-editor/CloudRulesSourcePicker';

import { ConfirmConversionModal } from './ConfirmConvertModal';
import { NamespaceAndGroupFilter } from './NamespaceAndGroupFilter';

export interface ImportFormValues {
  selectedDatasourceUID: string;
  selectedDatasourceName: string | null;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  targetFolder?: Folder;
  namespace?: string;
  ruleGroup?: string;
  targetDatasourceUID?: string;
}

const ImportFromDSRules = () => {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      selectedDatasourceUID: undefined,
      selectedDatasourceName: '',
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

  const [optionsShowing, toggleOptions] = useToggle(false);
  const [targetFolder, selectedDatasourceName] = watch(['targetFolder', 'selectedDatasourceName']);
  const [showConfirmModal, setShowConfirmModal] = useToggle(false);

  const onSubmit = async () => {
    setShowConfirmModal(true);
  };

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: t('alerting.import-to-gma.pageTitle', 'Import alert rules from a datasource to Grafana-managed rules'),
      }}
    >
      <Stack gap={2} direction={'column'}>
        <FormProvider {...formAPI}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack direction="column" gap={1}>
              <Field
                label={t('alerting.import-to-gma.datasource.label', 'Data source')}
                invalid={!!errors.selectedDatasourceName}
                error={errors.selectedDatasourceName?.message}
                htmlFor="datasource-picker"
              >
                <Controller
                  render={({ field: { onChange, ref, ...field } }) => (
                    <CloudRulesSourcePicker
                      {...field}
                      width={50}
                      inputId="datasource-picker"
                      onChange={(ds: DataSourceInstanceSettings) => {
                        setValue('selectedDatasourceUID', ds.uid);
                        setValue('selectedDatasourceName', ds.name);
                      }}
                    />
                  )}
                  name="selectedDatasourceName"
                  rules={{
                    required: {
                      value: true,
                      message: t('alerting.import-to-gma.datasource.required-message', 'Please select a datasource'),
                    },
                  }}
                  control={control}
                />
              </Field>

              <Collapse
                label={t('alerting.import-to-gma.optional-settings', 'Optional settings')}
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

                  <Field
                    label={t('alerting.import-to-gma.target-folder.label', 'Target folder')}
                    description={t(
                      'alerting.import-from-dsrules.description-folder-import-rules',
                      'The folder to import the rules to'
                    )}
                    invalid={!!errors.selectedDatasourceName}
                    error={errors.selectedDatasourceName?.message}
                    htmlFor="folder-picker"
                  >
                    <Controller
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Stack width={50}>
                          <NestedFolderPicker
                            showRootFolder={false}
                            invalid={!!errors.targetFolder?.message}
                            {...field}
                            value={targetFolder?.uid}
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
                      name="targetFolder"
                      control={control}
                    />
                  </Field>
                  <NamespaceAndGroupFilter rulesSourceName={selectedDatasourceName || undefined} />
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
                    <InlineSwitch transparent id="pause-alerting-rules" {...register('pauseAlertingRules')} />
                  </InlineField>
                </Box>

                <Divider />

                <Box>
                  <Box marginBottom={1} marginLeft={1}>
                    <Text variant="h5">{t('alerting.import-to-gma.recording-rules', 'Recording rules')}</Text>
                  </Box>

                  <InlineField
                    transparent={true}
                    label={t('alerting.import-to-gma.pause-recording.label', 'Pause imported recording rules')}
                    labelWidth={30}
                    htmlFor="pause-recording-rules"
                  >
                    <InlineSwitch transparent id="pause-recording-rules" {...register('pauseRecordingRules')} />
                  </InlineField>

                  <Box marginLeft={1} width={50}>
                    <Field
                      required={false}
                      id="target-data-source"
                      label={t('alerting.recording-rules.label-target-data-source', 'Target data source')}
                      description={t(
                        'alerting.recording-rules.description-target-data-source',
                        'The Prometheus data source to store recording rules in'
                      )}
                      error={errors.targetDatasourceUID?.message}
                      invalid={!!errors.targetDatasourceUID?.message}
                    >
                      <Controller
                        render={({ field: { onChange, ref, ...field } }) => (
                          <DataSourcePicker
                            {...field}
                            current={field.value}
                            noDefault
                            // Filter with `filter` prop instead of `type` prop to avoid showing the `-- Grafana --` data source
                            filter={(ds: DataSourceInstanceSettings) => ds.type === 'prometheus'}
                            onChange={(ds: DataSourceInstanceSettings) => {
                              setValue('targetDatasourceUID', ds.uid);
                            }}
                          />
                        )}
                        name="targetDatasourceUID"
                        control={control}
                      />
                    </Field>
                  </Box>
                </Box>
              </Collapse>
            </Stack>

            <Box marginTop={2}>
              <Stack gap={1}>
                <Button type="submit" variant="primary" disabled={isSubmitting || !selectedDatasourceName}>
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
            <ConfirmConversionModal isOpen={showConfirmModal} onDismiss={() => setShowConfirmModal(false)} />
          </form>
        </FormProvider>
      </Stack>
    </AlertingPageWrapper>
  );
};

export default withPageErrorBoundary(ImportFromDSRules);
