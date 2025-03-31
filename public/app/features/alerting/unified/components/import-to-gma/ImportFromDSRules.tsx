import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Box, Button, Collapse, Field, InlineField, InlineSwitch, LinkButton, Spinner, Stack, Text } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { Trans, t } from 'app/core/internationalization';

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
}

const ImportFromDSRules = () => {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      selectedDatasourceUID: undefined,
      selectedDatasourceName: '',
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetFolder: undefined,
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
                label={t('alerting.import-to-gma.datasource.label', 'Datasource')}
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
                <Stack direction={'column'} gap={0}>
                  <InlineField
                    transparent={true}
                    label={t('alerting.import-to-gma.target-folder.label', 'Target Folder (optional)')}
                    labelWidth={20}
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
                  </InlineField>

                  <InlineField
                    transparent={true}
                    label={t('alerting.import-to-gma.pause.label', 'Pause alerting rules')}
                    labelWidth={25}
                    tooltip={t('alerting.import-to-gma.pause.tooltip', 'Imported alerting rules will be paused.')}
                    htmlFor="pause-alerting-rules"
                  >
                    <InlineSwitch id="pause-alerting-rules" {...register('pauseAlertingRules')} />
                  </InlineField>

                  <InlineField
                    transparent={true}
                    label={t('alerting.import-to-gma.pause-recording.label', 'Pause recording rules')}
                    labelWidth={25}
                    tooltip={t(
                      'alerting.import-to-gma.pause-recording.tooltip',
                      'Imported recording rules will be paused.'
                    )}
                    htmlFor="pause-recording-rules"
                  >
                    <InlineSwitch id="pause-recording-rules" {...register('pauseRecordingRules')} />
                  </InlineField>
                </Stack>
                {selectedDatasourceName ? (
                  <Box marginLeft={1}>
                    <Box marginBottom={1}>
                      <Text variant="h5">{t('alerting.import-to-gma.filters', 'Filters')}</Text>
                    </Box>
                    <NamespaceAndGroupFilter rulesSourceName={selectedDatasourceName} />
                  </Box>
                ) : null}
              </Collapse>
            </Stack>

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
            <ConfirmConversionModal isOpen={showConfirmModal} onDismiss={() => setShowConfirmModal(false)} />
          </form>
        </FormProvider>
      </Stack>
    </AlertingPageWrapper>
  );
};

export default withPageErrorBoundary(ImportFromDSRules);
