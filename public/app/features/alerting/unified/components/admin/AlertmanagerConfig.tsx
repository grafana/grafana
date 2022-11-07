import { css } from '@emotion/css';
import React, { useEffect, useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ConfirmModal, TextArea, HorizontalGroup, Field, Form, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import {
  deleteAlertManagerConfigAction,
  fetchAlertManagerConfigAction,
  updateAlertManagerConfigAction,
} from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { AlertManagerPicker } from '../AlertManagerPicker';

interface FormValues {
  configJSON: string;
}

export default function AlertmanagerConfig(): JSX.Element {
  const dispatch = useDispatch();
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);

  const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
  const { loading: isDeleting } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
  const { loading: isSaving } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
  const readOnly = alertManagerSourceName ? isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName) : false;
  const styles = useStyles2(getStyles);

  const configRequests = useUnifiedAlertingSelector((state) => state.amConfigs);

  const {
    result: config,
    loading: isLoadingConfig,
    error: loadingError,
  } = (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState;

  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  const resetConfig = () => {
    if (alertManagerSourceName) {
      dispatch(deleteAlertManagerConfigAction(alertManagerSourceName));
    }
    setShowConfirmDeleteAMConfig(false);
  };

  const defaultValues = useMemo(
    (): FormValues => ({
      configJSON: config ? JSON.stringify(config, null, 2) : '',
    }),
    [config]
  );

  const loading = isDeleting || isLoadingConfig || isSaving;

  const onSubmit = (values: FormValues) => {
    if (alertManagerSourceName && config) {
      dispatch(
        updateAlertManagerConfigAction({
          newConfig: JSON.parse(values.configJSON),
          oldConfig: config,
          alertManagerSourceName,
          successMessage: 'Alertmanager configuration updated.',
          refetch: true,
        })
      );
    }
  };

  return (
    <div className={styles.container}>
      <AlertManagerPicker
        current={alertManagerSourceName}
        onChange={setAlertManagerSourceName}
        dataSources={alertManagers}
      />
      {loadingError && !loading && (
        <Alert severity="error" title="Error loading Alertmanager configuration">
          {loadingError.message || 'Unknown error.'}
        </Alert>
      )}
      {isDeleting && alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME && (
        <Alert severity="info" title="Resetting Alertmanager configuration">
          It might take a while...
        </Alert>
      )}
      {alertManagerSourceName && config && (
        <Form defaultValues={defaultValues} onSubmit={onSubmit} key={defaultValues.configJSON}>
          {({ register, errors }) => (
            <>
              {!readOnly && (
                <Field
                  disabled={loading}
                  label="Configuration"
                  invalid={!!errors.configJSON}
                  error={errors.configJSON?.message}
                >
                  <TextArea
                    {...register('configJSON', {
                      required: { value: true, message: 'Required.' },
                      validate: (v) => {
                        try {
                          JSON.parse(v);
                          return true;
                        } catch (e) {
                          return e instanceof Error ? e.message : 'Invalid JSON.';
                        }
                      },
                    })}
                    id="configuration"
                    rows={25}
                  />
                </Field>
              )}
              {readOnly && (
                <Field label="Configuration">
                  <pre data-testid="readonly-config">{defaultValues.configJSON}</pre>
                </Field>
              )}
              {!readOnly && (
                <HorizontalGroup>
                  <Button type="submit" variant="primary" disabled={loading}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    variant="destructive"
                    onClick={() => setShowConfirmDeleteAMConfig(true)}
                  >
                    Reset configuration
                  </Button>
                </HorizontalGroup>
              )}
              {!!showConfirmDeleteAMConfig && (
                <ConfirmModal
                  isOpen={true}
                  title="Reset Alertmanager configuration"
                  body={`Are you sure you want to reset configuration ${
                    alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME
                      ? 'for the Grafana Alertmanager'
                      : `for "${alertManagerSourceName}"`
                  }? Contact points and notification policies will be reset to their defaults.`}
                  confirmText="Yes, reset configuration"
                  onConfirm={resetConfig}
                  onDismiss={() => setShowConfirmDeleteAMConfig(false)}
                />
              )}
            </>
          )}
        </Form>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(4)};
  `,
});
