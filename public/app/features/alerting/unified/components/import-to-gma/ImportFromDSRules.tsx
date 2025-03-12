import { css } from '@emotion/css';
import { Controller, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Box, Button, InlineField, InlineSwitch, Spinner, useStyles2 } from '@grafana/ui';

import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';

interface ImportFormValues {
  selectedDatasource?: DataSourceInstanceSettings;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  folderTarget?: string;
}

const ImportFromDSRules = () => {
  const {
    register,
    handleSubmit,
    setError,
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
      folderTarget: undefined,
    },
  });

  const styles = useStyles2(getStyles);

  // const selectedDatasource = watch('selectedDatasource');
  // const pauseAlertingRules = watch('pauseAlertingRules');
  // const pauseRecordingRules = watch('pauseRecordingRules');

  const onSubmit = async (data: ImportFormValues) => {
    if (!data.selectedDatasource) {
      setError('selectedDatasource', { type: 'manual', message: 'Please select a datasource.' });
      return;
    }

    // await response calling api to import rules ..if we get an error show and not redirect
    // if success show success message and redirect to alerting page /list
  };

  return (
    <AlertingPageWrapper navId="alert-list" pageNav={{ text: 'Import alert rules from a datasource' }}>
      <Box maxWidth={300}>
        <p style={{ textAlign: 'left', marginBottom: '20px' }}>
          Migrate your alert rules from a datasource into Grafana.
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box marginBottom={4}>
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
                    width={40}
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
          </Box>

          <Box marginBottom={4}>
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
          </Box>

          <Box marginBottom={4}>
            <InlineField
              transparent={true}
              label="Pause recording rules"
              labelWidth={25}
              tooltip="Imported recording rules will be paused."
            >
              <InlineSwitch
                {...register('pauseRecordingRules')}
                // checked={pauseRecordingRules}
                // onChange={() => setValue('pauseRecordingRules', !pauseRecordingRules, { shouldDirty: true })}
              />
            </InlineField>
          </Box>

          <Box display="flex" justifyContent="left">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !watch('selectedDatasource')}
              onClick={() => clearErrors()}
            >
              {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
              Import
            </Button>
          </Box>
        </form>
      </Box>
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
