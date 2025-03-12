import { css } from '@emotion/css';
import { Controller, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2, urlUtil } from '@grafana/data';
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

    try {
      const queryParams = new URLSearchParams({
        pauseRecordingRules: String(data.pauseRecordingRules),
        pauseAlerts: String(data.pauseAlertingRules),
      });
      const url = `/api/ruler/${data.selectedDatasource.uid}/api/v1/rules/convert?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to import rules: ${response.status} ${response.statusText} ${errorText}`);
      }

      await response.json();
      window.location.href = urlUtil.renderUrl('alerting/list', {});
    } catch (err) {
      if (err instanceof Error) {
        setError('selectedDatasource', { type: 'manual', message: err.message });
      }
    }
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
                    // onChange={(ds: DataSourceInstanceSettings | null) => {
                    //   setValue('selectedDatasource', ds, { shouldDirty: true });
                    //   clearErrors('selectedDatasource');
                    // }}
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