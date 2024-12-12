import { css } from '@emotion/css';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { urlUtil, DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import {
  Spinner,
  withErrorBoundary,
  Collapse,
  Button,
  Box,
  InlineField,
  Input,
  InlineSwitch,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

interface FormValues {
  selectedDatasource: DataSourceInstanceSettings | null;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  namespace: string;
  group: string;
}

const RuleImporter = () => {
  const styles = useStyles2(getStyles);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

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
      namespace: '',
      group: '',
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
        namespace: data.namespace,
        group: data.group,
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

      const namespaceValue = data.namespace.trim();
      const groupValue = data.group.trim();
      const searchParts: string[] = [];

      if (namespaceValue) {
        searchParts.push(`namespace:"${namespaceValue}"`);
      }
      if (groupValue) {
        searchParts.push(`group:"${groupValue}"`);
      }

      const queryObj: Record<string, string> = {};

      if (searchParts.length > 0) {
        queryObj.search = searchParts.join(' ');
      }

      window.location.href = urlUtil.renderUrl('alerting/list', queryObj);
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
          <Trans i18nKey="migrate-alert-rules-from-datasource">
            Migrate your alert rules from a datasource into Grafana.
          </Trans>
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

          <Box marginBottom={4} width={100}>
            <Collapse
              label="Filters (optional)"
              collapsible={true}
              isOpen={advancedFiltersOpen}
              onToggle={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
            >
              <Box marginBottom={4}>
                <InlineField
                  transparent={true}
                  label="Enter namespace to import"
                  tooltip="If empty, all namespaces are imported"
                  labelWidth={30}
                >
                  <Input id="group-name" placeholder="Namespace" width={40} {...register('namespace')} />
                </InlineField>
              </Box>

              <Box marginBottom={4}>
                <InlineField
                  transparent={true}
                  label="Enter rule group name to import"
                  tooltip="If empty, all namespaces are imported"
                  labelWidth={30}
                >
                  <Input id="group-name" placeholder="Rule group" width={40} {...register('group')} />
                </InlineField>
              </Box>
            </Collapse>
          </Box>

          <Box display="flex" justifyContent="left">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !selectedDatasource}
              onClick={() => clearErrors()}
            >
              {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
              <Trans i18nKey="import-alert-rules-button">Import</Trans>
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
