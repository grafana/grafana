import { css } from '@emotion/css';
import React, { useEffect, useState, useMemo } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, useStyles2, Select } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import {
  deleteAlertManagerConfigAction,
  fetchAlertManagerConfigAction,
  fetchValidAlertManagerConfigAction,
  updateAlertManagerConfigAction,
} from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { AlertManagerPicker } from '../AlertManagerPicker';

import { ConfigEditor } from './ConfigEditor';

export interface FormValues {
  configJSON: string;
}
interface ValidAmConfigOption {
  label: string;
  value: AlertManagerCortexConfig;
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
  const { loading: isFetchingValidAmConfigs, result: validAmConfigs } = useUnifiedAlertingSelector(
    (state) => state.validAmConfigs
  );

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

  useAsync(async () => {
    if (!loadingError || alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
      return;
    }
    dispatch(fetchValidAlertManagerConfigAction());
  }, [loadingError, alertManagerSourceName, dispatch]);

  const validAmConfigsOptions = useMemo(() => {
    if (!validAmConfigs?.length) {
      return [];
    }

    const configs: ValidAmConfigOption[] = validAmConfigs.map((config, index) => ({
      label: `Config ${index + 1}`,
      value: config,
    }));
    setSelectedAmConfig(configs[0]);
    return configs;
  }, [validAmConfigs]);

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
          <Alert severity="error" title="Error loading Alertmanager configuration">
            {loadingError.message || 'Unknown error.'}
          </Alert>

          {!isFetchingValidAmConfigs && validAmConfigs && validAmConfigs.length > 0 && (
            <>
              <div>Choose a previous working configuration</div>

              <Select
                className={styles.container}
                options={validAmConfigsOptions}
                value={selectedAmConfig}
                onChange={(value: SelectableValue) => {
                  // @ts-ignore
                  setSelectedAmConfig(value);
                }}
              />

              <ConfigEditor
                defaultValues={defaultValidValues}
                onSubmit={(values) => onSubmit(values, false, selectedAmConfig?.value)}
                readOnly={readOnly}
                loading={loading}
                alertManagerSourceName={alertManagerSourceName}
              />
            </>
          )}
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
