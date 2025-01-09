import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, CodeEditor, ConfirmModal, Stack, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { reportFormErrors } from '../../Analytics';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { Spacer } from '../Spacer';

export interface FormValues {
  configJSON: string;
}

interface Props {
  alertmanagerName: string;
  onDismiss: () => void;
  onSave: (dataSourceName: string, oldConfig: string, newConfig: string) => void;
  onReset: (dataSourceName: string) => void;
}

export default function AlertmanagerConfig({ alertmanagerName, onDismiss, onSave, onReset }: Props): JSX.Element {
  const { loading: isDeleting, error: deletingError } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
  const { loading: isSaving, error: savingError } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  // ⚠️ provisioned data sources should not prevent the configuration from being edited
  const immutableDataSource = alertmanagerName ? isVanillaPrometheusAlertManagerDataSource(alertmanagerName) : false;
  const readOnly = immutableDataSource;

  const isGrafanaManagedAlertmanager = alertmanagerName === GRAFANA_RULES_SOURCE_NAME;
  const styles = useStyles2(getStyles);

  const {
    currentData: config,
    error: loadingError,
    isSuccess: isLoadingSuccessful,
    isLoading: isLoadingConfig,
  } = useAlertmanagerConfig(alertmanagerName);

  const defaultValues = {
    configJSON: config ? JSON.stringify(config, null, 2) : '',
  };

  const {
    register,
    setValue,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  // make sure we update the configJSON field when we receive a response from the `useAlertmanagerConfig` hook
  useEffect(() => {
    if (config) {
      setValue('configJSON', JSON.stringify(config, null, 2));
    }
  }, [config, setValue]);

  useEffect(() => {
    if (savingError) {
      setError('configJSON', { type: 'deps', message: savingError.message });
    }
  }, [savingError, setError]);

  useEffect(() => {
    if (deletingError) {
      setError('configJSON', { type: 'deps', message: deletingError.message });
    }
  }, [deletingError, setError]);

  // manually register the config field with validation
  // @TODO sometimes the value doesn't get registered – find out why
  register('configJSON', {
    required: { value: true, message: 'Configuration cannot be empty' },
    validate: (value: string) => {
      try {
        JSON.parse(value);
        return true;
      } catch (e) {
        return e instanceof Error ? e.message : 'JSON is invalid';
      }
    },
  });

  const handleSave = handleSubmit((values: FormValues) => {
    onSave(alertmanagerName, defaultValues.configJSON, values.configJSON);
  }, reportFormErrors);

  const isOperating = isLoadingConfig || isDeleting || isSaving;

  /* loading error, if this fails don't bother rendering the form */
  if (loadingError) {
    return (
      <Alert severity="error" title="Failed to load Alertmanager configuration">
        {loadingError.message ?? 'An unknown error occurred.'}
      </Alert>
    );
  }

  /* resetting configuration state */
  if (isDeleting) {
    return (
      <Alert severity="info" title="Resetting Alertmanager configuration">
        Resetting configuration, this might take a while.
      </Alert>
    );
  }

  const confirmationText = isGrafanaManagedAlertmanager
    ? `Are you sure you want to reset configuration for the Grafana Alertmanager? Contact points and notification policies will be reset to their defaults.`
    : `Are you sure you want to reset configuration for "${alertmanagerName}"? Contact points and notification policies will be reset to their defaults.`;

  return (
    <div className={styles.container}>
      {/* form error state */}
      {errors.configJSON && (
        <Alert severity="error" title="Oops, something went wrong">
          {errors.configJSON.message || 'An unknown error occurred.'}
        </Alert>
      )}

      {isLoadingSuccessful && (
        <div className={styles.content}>
          <AutoSizer>
            {({ height, width }) => (
              <CodeEditor
                language="json"
                width={width}
                height={height}
                showLineNumbers={true}
                monacoOptions={{
                  scrollBeyondLastLine: false,
                }}
                value={defaultValues.configJSON}
                showMiniMap={false}
                onSave={(value) => setValue('configJSON', value)}
                onBlur={(value) => setValue('configJSON', value)}
                readOnly={isOperating}
              />
            )}
          </AutoSizer>
        </div>
      )}

      <Stack justifyContent="flex-end">
        {!readOnly && (
          <Button variant="destructive" onClick={() => setShowResetConfirmation(true)} disabled={isOperating}>
            Reset
          </Button>
        )}
        <Spacer />
        <Button variant="secondary" onClick={() => onDismiss()} disabled={isOperating}>
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
        </Button>
        {!readOnly && (
          <Button variant="primary" onClick={handleSave} disabled={isOperating}>
            <Trans i18nKey="common.save">Save</Trans>
          </Button>
        )}
      </Stack>
      <ConfirmModal
        isOpen={showResetConfirmation}
        title="Reset Alertmanager configuration"
        body={confirmationText}
        confirmText="Yes, reset configuration"
        onConfirm={() => {
          onReset(alertmanagerName);
          setShowResetConfirmation(false);
        }}
        onDismiss={() => {
          setShowResetConfirmation(false);
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: theme.spacing(2),
  }),
  content: css({
    flex: '1 1 100%',
  }),
});
