import { css } from '@emotion/css';
import React, { useEffect, useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import {
  deleteAlertManagerConfigAction,
  fetchAlertManagerConfigAction,
  updateAlertManagerConfigAction,
} from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';

import AlertmanagerConfigSelector, { ValidAmConfigOption } from './AlertmanagerConfigSelector';
import { ConfigEditor } from './ConfigEditor';

export interface FormValues {
  configJSON: string;
}

export default function AlertmanagerConfig(): JSX.Element {
  const dispatch = useDispatch();

  const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
  const { loading: isDeleting } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
  const { loading: isSaving } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
  const { selectedAlertmanager } = useAlertmanager();

  const readOnly = selectedAlertmanager ? isVanillaPrometheusAlertManagerDataSource(selectedAlertmanager) : false;
  const styles = useStyles2(getStyles);

  const configRequests = useUnifiedAlertingSelector((state) => state.amConfigs);

  const [selectedAmConfig, setSelectedAmConfig] = useState<ValidAmConfigOption | undefined>();

  const {
    result: config,
    loading: isLoadingConfig,
    error: loadingError,
  } = (selectedAlertmanager && configRequests[selectedAlertmanager]) || initialAsyncRequestState;

  useEffect(() => {
    if (selectedAlertmanager) {
      dispatch(fetchAlertManagerConfigAction(selectedAlertmanager));
    }
  }, [selectedAlertmanager, dispatch]);

  const resetConfig = () => {
    if (selectedAlertmanager) {
      dispatch(deleteAlertManagerConfigAction(selectedAlertmanager));
    }
    setShowConfirmDeleteAMConfig(false);
  };

  const defaultValues = useMemo(
    (): FormValues => ({
      configJSON: config ? JSON.stringify(config, null, 2) : '',
    }),
    [config]
  );

  const defaultValidValues = useMemo(
    (): FormValues => ({
      configJSON: selectedAmConfig ? JSON.stringify(selectedAmConfig.value, null, 2) : '',
    }),
    [selectedAmConfig]
  );

  const loading = isDeleting || isLoadingConfig || isSaving;

  const onSubmit = (values: FormValues) => {
    if (selectedAlertmanager && config) {
      dispatch(
        updateAlertManagerConfigAction({
          newConfig: JSON.parse(values.configJSON),
          oldConfig: config,
          alertManagerSourceName: selectedAlertmanager,
          successMessage: 'Alertmanager configuration updated.',
          refetch: true,
        })
      );
    }
  };

  return (
    <div className={styles.container}>
      {loadingError && !loading && (
        <>
          <Alert
            severity="error"
            title="Your Alertmanager configuration is incorrect. These are the details of the error:"
          >
            {loadingError.message || 'Unknown error.'}
          </Alert>

          {selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME && (
            <AlertmanagerConfigSelector
              onChange={setSelectedAmConfig}
              selectedAmConfig={selectedAmConfig}
              defaultValues={defaultValidValues}
              readOnly={true}
              loading={loading}
              onSubmit={onSubmit}
            />
          )}
        </>
      )}
      {isDeleting && selectedAlertmanager !== GRAFANA_RULES_SOURCE_NAME && (
        <Alert severity="info" title="Resetting Alertmanager configuration">
          It might take a while...
        </Alert>
      )}
      {selectedAlertmanager && config && (
        <ConfigEditor
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(values)}
          readOnly={readOnly}
          loading={loading}
          alertManagerSourceName={selectedAlertmanager}
          showConfirmDeleteAMConfig={showConfirmDeleteAMConfig}
          onReset={() => setShowConfirmDeleteAMConfig(true)}
          onConfirmReset={resetConfig}
          onDismiss={() => setShowConfirmDeleteAMConfig(false)}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(4)};
  `,
});
