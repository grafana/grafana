import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, CodeEditor, ConfirmModal, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

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
  const isGrafanaManagedAlertmanager = alertmanagerName === GRAFANA_RULES_SOURCE_NAME;

  // ⚠️ provisioned data sources should not prevent the configuration from being edited
  const immutableDataSource = alertmanagerName ? isVanillaPrometheusAlertManagerDataSource(alertmanagerName) : false;
  const readOnly = immutableDataSource || isGrafanaManagedAlertmanager;

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
      <Alert
        severity="error"
        title={t(
          'alerting.alertmanager-config.title-failed-to-load-alertmanager-configuration',
          'Failed to load Alertmanager configuration'
        )}
      >
        {loadingError.message ?? 'An unknown error occurred.'}
      </Alert>
    );
  }

  /* resetting configuration state */
  if (isDeleting) {
    return (
      <Alert
        severity="info"
        title={t(
          'alerting.alertmanager-config.title-resetting-alertmanager-configuration',
          'Resetting Alertmanager configuration'
        )}
      >
        <Trans i18nKey="alerting.alertmanager-config.resetting-configuration-might-while">
          Resetting configuration, this might take a while.
        </Trans>
      </Alert>
    );
  }

  const confirmationText = t(
    'alerting.alertmanager-config.reset-confirmation',
    'Are you sure you want to reset configuration for "{{alertmanagerName}}"? Contact points and notification policies will be reset to their defaults.',
    { alertmanagerName }
  );

  return (
    <div className={styles.container}>
      {isGrafanaManagedAlertmanager && (
        <Alert
          severity="info"
          title={t(
            'alerting.alertmanager-config.gma-manual-configuration-is-not-supported',
            'Manual configuration changes not supported'
          )}
        >
          <Trans i18nKey="alerting.alertmanager-config.gma-manual-configuration-description">
            The internal Grafana Alertmanager configuration cannot be manually changed. To change this configuration,
            edit the individual resources through the UI.
          </Trans>
        </Alert>
      )}
      {/* form error state */}
      {errors.configJSON && (
        <Alert
          severity="error"
          title={t('alerting.alertmanager-config.title-oops-something-went-wrong', 'Oops, something went wrong')}
        >
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
            <Trans i18nKey="alerting.alertmanager-config.reset">Reset</Trans>
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
        title={t(
          'alerting.alertmanager-config.title-reset-alertmanager-configuration',
          'Reset Alertmanager configuration'
        )}
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
