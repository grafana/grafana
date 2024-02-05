import { css } from '@emotion/css';
import React, { useState, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteAlertManagerConfigAction, updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';

import AlertmanagerConfigSelector, { ValidAmConfigOption } from './AlertmanagerConfigSelector';
import { ConfigEditor } from './ConfigEditor';

export interface FormValues {
  configJSON: string;
}

interface Props {
  alertmanagerName: string;
  onDismiss: () => void;
}

export default function AlertmanagerConfig({ alertmanagerName, onDismiss }: Props): JSX.Element {
  const dispatch = useDispatch();

  const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
  const { loading: isDeleting } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
  const { loading: isSaving } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const readOnly = alertmanagerName ? isVanillaPrometheusAlertManagerDataSource(alertmanagerName) : false;
  const styles = useStyles2(getStyles);

  const handleDismiss = () => onDismiss();

  const [selectedAmConfig, setSelectedAmConfig] = useState<ValidAmConfigOption | undefined>();

  const {
    currentData: config,
    error: loadingError,
    isLoading: isLoadingConfig,
  } = useAlertmanagerConfig(alertmanagerName);

  const resetConfig = () => {
    if (alertmanagerName) {
      dispatch(deleteAlertManagerConfigAction(alertmanagerName));
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
    if (alertmanagerName && config) {
      dispatch(
        updateAlertManagerConfigAction({
          newConfig: JSON.parse(values.configJSON),
          oldConfig: config,
          alertManagerSourceName: alertmanagerName,
          successMessage: 'Alertmanager configuration updated.',
        })
      );
    }
  };

  return (
    <div className={styles.container}>
      {/* error state */}
      {loadingError && !loading && (
        <>
          <Alert
            severity="error"
            title="Your Alertmanager configuration is incorrect. These are the details of the error:"
          >
            {loadingError.message || 'Unknown error.'}
          </Alert>

          {alertmanagerName === GRAFANA_RULES_SOURCE_NAME && (
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

      {/* resetting state */}
      {isDeleting && alertmanagerName !== GRAFANA_RULES_SOURCE_NAME && (
        <Alert severity="info" title="Resetting Alertmanager configuration">
          It might take a while...
        </Alert>
      )}

      <div className={styles.content}>
        <AutoSizer>
          {({ height, width }) => (
            <ConfigEditor
              defaultValues={defaultValues}
              onSubmit={(values) => onSubmit(values)}
              readOnly={readOnly}
              loading={loading}
              height={height}
              width={width}
              alertManagerSourceName={alertmanagerName}
              showConfirmDeleteAMConfig={showConfirmDeleteAMConfig}
              onReset={() => setShowConfirmDeleteAMConfig(true)}
              onConfirmReset={resetConfig}
              onDismiss={() => setShowConfirmDeleteAMConfig(false)}
            />
          )}
        </AutoSizer>
      </div>
      {!readOnly && (
        <Stack justifyContent="flex-end">
          <Button variant="destructive" onClick={() => undefined}>
            Reset
          </Button>
          <Button variant="secondary" onClick={handleDismiss}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => undefined}>
            Save
          </Button>
        </Stack>
      )}
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
