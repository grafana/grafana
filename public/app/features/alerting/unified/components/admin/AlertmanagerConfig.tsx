import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ConfirmModal, TextArea, HorizontalGroup, Field, Form, useStyles2 } from '@grafana/ui';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import {
  deleteAlertManagerConfigAction,
  fetchAlertManagerConfigAction,
  updateAlertManagerConfigAction,
} from '../../state/actions';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';

interface FormValues {
  configJSON: string;
}

export const AlertmanagerConfig = () => {
  const dispatch = useDispatch();
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
  const { loading: isDeleting } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
  const { loading: isSaving } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
  const styles = useStyles2(getStyles);

  const configRequests = useUnifiedAlertingSelector((state) => state.amConfigs);

  const { result: config, loading: isLoadingConfig, error: loadingError } =
    (alertManagerSourceName && configRequests[alertManagerSourceName]) || initialAsyncRequestState;

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
    if (alertManagerSourceName) {
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
    <div className={styles.wrapper}>
      <h4>Global Alertmanager config</h4>
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
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
        <Form defaultValues={defaultValues} onSubmit={onSubmit} key={defaultValues.configJSON} maxWidth={800}>
          {({ register, errors }) => (
            <>
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
                        return e.message;
                      }
                    },
                  })}
                  id="configuration"
                  rows={15}
                  cols={15}
                />
              </Field>
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
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-bottom: ${theme.spacing(5)};
  `,
});
