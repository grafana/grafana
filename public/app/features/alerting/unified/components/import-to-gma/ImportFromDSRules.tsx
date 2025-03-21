import { isEmpty } from 'lodash';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Collapse, InlineField, InlineSwitch, Spinner, Stack, Text } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans, t } from 'app/core/internationalization';

import { convertToGMAApi } from '../../api/convertToGMAApi';
import { Folder } from '../../types/rule-form';
import { stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { CloudRulesSourcePicker } from '../rule-editor/CloudRulesSourcePicker';
import { createListFilterLink } from '../rule-viewer/RuleViewer';

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

  const [targetFolder, selectedDatasourceName] = watch(['targetFolder', 'selectedDatasourceName']);
  const [convert] = convertToGMAApi.useConvertToGMAMutation();

  const onSubmit = async (data: ImportFormValues) => {
    try {
      await convert({
        datasourceUID: data.selectedDatasourceUID,
        targetFolderUID: data.targetFolder?.uid,
        pauseRecordingRules: data.pauseRecordingRules,
        pauseAlerts: data.pauseAlertingRules,
        ...(data.namespace ? { namespace: data.namespace } : {}),
        ...(data.ruleGroup ? { group: data.ruleGroup } : {}),
      }).unwrap();

      const isRootFolder = isEmpty(data.targetFolder?.uid);

      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', data.targetFolder?.title ?? '']]);
      notifyApp.success(
        t('alerting.import-to-gma.success', 'Successfully exported alert rules to Grafana-managed rules.')
      );
      locationService.push(ruleListUrl);
    } catch (error) {
      notifyApp.error(
        t('alerting.import-to-gma.error', 'Failed to export alert rules: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
    }
  };

  const notifyApp = useAppNotification();
  const [optionsShowing, toggleOptions] = useToggle(false);

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: t('alerting.import-to-gma.pageTitle', 'Export alert rules from a datasource to Grafana-managed rules.'),
      }}
    >
      <Stack gap={2} direction={'column'}>
        <Text element="h2" variant="h5">
          <Trans i18nKey="alerting.import-to-gma.title">Migrate your alert rules from a datasource into Grafana.</Trans>
        </Text>
        <FormProvider {...formAPI}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <InlineField
              transparent={true}
              label={t('alerting.import-to-gma.datasource.label', 'Datasource')}
              labelWidth={20}
              invalid={!!errors.selectedDatasourceName}
              error={errors.selectedDatasourceName?.message}
            >
              <Controller
                render={({ field: { onChange, ref, ...field } }) => (
                  <CloudRulesSourcePicker
                    {...field}
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
            </InlineField>

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
                  tooltip={t('alerting.import-to-gma.pause.tooltip', 'Exported alerting rules will be paused.')}
                >
                  <InlineSwitch {...register('pauseAlertingRules')} />
                </InlineField>

                <InlineField
                  transparent={true}
                  label={t('alerting.import-to-gma.pause-recording.label', 'Pause recording rules')}
                  labelWidth={25}
                  tooltip={t(
                    'alerting.import-to-gma.pause-recording.tooltip',
                    'Exported recording rules will be paused.'
                  )}
                >
                  <InlineSwitch {...register('pauseRecordingRules')} />
                </InlineField>

                {selectedDatasourceName ? (
                  <Stack direction="column">
                    <Text variant="h4">{t('alerting.import-to-gma.optional-filters', 'Optional filters')}</Text>
                    <NamespaceAndGroupFilter rulesSourceName={selectedDatasourceName} />
                  </Stack>
                ) : null}
              </Stack>
            </Collapse>

            <Button type="submit" variant="primary" disabled={isSubmitting || !selectedDatasourceName}>
              <Stack direction="row" gap={2} alignItems="center">
                {isSubmitting && <Spinner inline={true} />}
                <Trans i18nKey="alerting.import-to-gma.action-button">Export</Trans>
              </Stack>
            </Button>
          </form>
        </FormProvider>
      </Stack>
    </AlertingPageWrapper>
  );
};

export default withPageErrorBoundary(ImportFromDSRules);
