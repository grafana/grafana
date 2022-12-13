import { css } from '@emotion/css';
import React, { useEffect, useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
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

import AlertmanagerConfigSelector, { ValidAmConfigOption } from './AlertmanagerConfigSelector';
import { ConfigEditor } from './ConfigEditor';

export interface FormValues {
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

  const [selectedAmConfig, setSelectedAmConfig] = useState<ValidAmConfigOption | undefined>();

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

  const defaultValidValues = useMemo(
    (): FormValues => ({
      configJSON: selectedAmConfig ? JSON.stringify(selectedAmConfig.value, null, 2) : '',
    }),
    [selectedAmConfig]
  );

  const loading = isDeleting || isLoadingConfig || isSaving;

  const onSubmit = (values: FormValues, fetchLatestConfig: boolean, oldConfig?: AlertManagerCortexConfig) => {
    if (alertManagerSourceName && oldConfig) {
      dispatch(
        updateAlertManagerConfigAction({
          newConfig: JSON.parse(values.configJSON),
          oldConfig: oldConfig,
          alertManagerSourceName,
          successMessage: 'Alertmanager configuration updated.',
          refetch: true,
          fetchLatestConfig,
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
        <>
          <Alert
            severity="error"
            title="Your Alertmanager configuration is incorrect. These are the details of the error:"
          >
            {loadingError.message || 'Unknown error.'}
          </Alert>

          <AlertmanagerConfigSelector
            onChange={setSelectedAmConfig}
            selectedAmConfig={selectedAmConfig}
            defaultValues={defaultValidValues}
            readOnly={readOnly}
            loading={loading}
            alertManagerSourceName={alertManagerSourceName}
            onSubmit={onSubmit}
          />
        </>
      )}
      {isDeleting && alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME && (
        <Alert severity="info" title="Resetting Alertmanager configuration">
          It might take a while...
        </Alert>
      )}
      {alertManagerSourceName && config && (
        <ConfigEditor
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(values, true, config)}
          readOnly={readOnly}
          loading={loading}
          alertManagerSourceName={alertManagerSourceName}
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
