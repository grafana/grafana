import { css } from '@emotion/css';
import { useForm } from 'react-hook-form';

import { urlUtil, DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Spinner, withErrorBoundary, Button, Box, InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

interface FormValues {
  selectedDatasource: DataSourceInstanceSettings | null;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
}

const RuleImporter = () => {
  const styles = useStyles2(getStyles);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      selectedDatasource: null,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
    },
  });

  const selectedDatasource = watch('selectedDatasource');
  const pauseAlertingRules = watch('pauseAlertingRules');
  const pauseRecordingRules = watch('pauseRecordingRules');

  const onSubmit = async (data: FormValues) => {
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
              labelWidth={30}
              invalid={!!errors.selectedDatasource}
              error={errors.selectedDatasource?.message}
            >
              <DataSourcePicker
                inputId="input-id-alerting-import-datasource-picker"
                onChange={(ds: DataSourceInstanceSettings | null) => {
                  setValue('selectedDatasource', ds, { shouldDirty: true });
                  clearErrors('selectedDatasource');
                }}
                current={selectedDatasource ?? undefined}
                noDefault={true}
                placeholder="Select a datasource"
                alerting={true}
                filter={(ds) => !!ds.meta.alerting}
                width={40}
                type={['prometheus', 'loki']}
              />
            </InlineField>
          </Box>

          <Box marginBottom={4}>
            <InlineField
              transparent={true}
              label="Pause alerting rules"
              labelWidth={30}
              tooltip="Imported alerting rules will be paused."
            >
              <InlineSwitch
                {...register('pauseAlertingRules')}
                checked={pauseAlertingRules}
                transparent={true}
                onChange={() => setValue('pauseAlertingRules', !pauseAlertingRules, { shouldDirty: true })}
              />
            </InlineField>
          </Box>

          <Box marginBottom={4}>
            <InlineField
              transparent={true}
              label="Pause recording rules"
              labelWidth={30}
              tooltip="Imported recording rules will be paused."
            >
              <InlineSwitch
                {...register('pauseRecordingRules')}
                checked={pauseRecordingRules}
                transparent={true}
                onChange={() => setValue('pauseRecordingRules', !pauseRecordingRules, { shouldDirty: true })}
              />
            </InlineField>
          </Box>

          <Box display="flex" justifyContent="left">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !selectedDatasource}
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

export default withErrorBoundary(RuleImporter, { style: 'page' });

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSpinner: css({
    marginRight: theme.spacing(1),
  }),
  error: css({
    color: theme.colors.error.text,
  }),
});
