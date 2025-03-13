import { css } from '@emotion/css';
import { Controller, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker, locationService } from '@grafana/runtime';
import { Button, InlineField, InlineSwitch, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { Folder } from '../../types/rule-form';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';


interface ImportFormValues {
  selectedDatasource?: DataSourceInstanceSettings;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  targetFolder?: Folder;
}

const ImportFromDSRules = () => {
  const {
    register,
    handleSubmit,
    clearErrors,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ImportFormValues>({
    defaultValues: {
      selectedDatasource: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetFolder: undefined,
    },
  });

  const styles = useStyles2(getStyles);

  const targetFolder = watch('targetFolder');

  const onSubmit = async (data: ImportFormValues) => {
    // if (!data.selectedDatasource) {
    //   setError('selectedDatasource', { type: 'manual', message: 'Please select a datasource.' });
    //   return;
    // }
    console.log(data);
    // await response calling api to import rules ..if we get an error show and not redirect
    // if success show success message and redirect to alerting page /list
    const ruleListUrl = createRelativeUrl('/alerting/list');
    locationService.push(ruleListUrl);
  };

  return (
    <AlertingPageWrapper navId="alert-list" pageNav={{ text: 'Import alert rules from a datasource' }}>
      <Stack gap={2} direction={'column'}>
        <Text element="h2" variant="h5">
          Migrate your alert rules from a datasource into Grafana.
        </Text>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack gap={2} direction={'column'}>
            <InlineField
              transparent={true}
              label="Datasource"
              labelWidth={20}
              invalid={!!errors.selectedDatasource}
              error={errors.selectedDatasource?.message}
            >
              <Controller
                render={({ field: { onChange, ref, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    current={field.value}
                    onChange={(ds: DataSourceInstanceSettings) => {
                      setValue('selectedDatasource', ds);
                    }}
                    noDefault={true}
                    placeholder="Select a datasource"
                    alerting={true}
                    filter={(ds) => !!ds.meta.alerting}
                    width={50}
                    type={['prometheus', 'loki']}
                  />
                )}
                name="selectedDatasource"
                rules={{
                  required: { value: true, message: 'Please select a datasource' },
                }}
                control={control}
              />
            </InlineField>

            <InlineField
              transparent={true}
              label="Folder"
              labelWidth={20}
              invalid={!!errors.selectedDatasource}
              error={errors.selectedDatasource?.message}
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
                rules={{
                  required: { value: true, message: 'Please select a target folder' },
                }}
                control={control}
              />
            </InlineField>


            <InlineField
              transparent={true}
              label="Pause alerting rules"
              labelWidth={25}
              tooltip="Imported alerting rules will be paused."
            >
              <InlineSwitch
                {...register('pauseAlertingRules')}
              // checked={pauseAlertingRules}
              // onChange={() => setValue('pauseAlertingRules', !pauseAlertingRules, { shouldDirty: true })}
              />
            </InlineField>

            <InlineField
              transparent={true}
              label="Pause recording rules"
              labelWidth={25}
              tooltip="Imported recording rules will be paused."
            >
              <InlineSwitch
                {...register('pauseRecordingRules')}
              />
            </InlineField>

            <Stack>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !watch('selectedDatasource') || !watch('targetFolder')}
                onClick={() => clearErrors()}
              >
                {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
                Import
              </Button>
            </Stack>
          </Stack>
        </form>
      </Stack>
    </AlertingPageWrapper>
  );
};

export default withPageErrorBoundary(ImportFromDSRules);

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSpinner: css({
    marginRight: theme.spacing(1),
  }),
  error: css({
    color: theme.colors.error.text,
  }),
});
