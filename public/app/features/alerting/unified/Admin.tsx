import React, { useState } from 'react';
import { Button, ConfirmModal } from '@grafana/ui';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { useDispatch } from 'react-redux';
import { deleteAlertManagerConfigAction } from './state/actions';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';

export default function Admin(): JSX.Element {
  const dispatch = useDispatch();
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
  const { loading } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);

  const resetConfig = () => {
    if (alertManagerSourceName) {
      dispatch(deleteAlertManagerConfigAction(alertManagerSourceName));
    }
    setShowConfirmDeleteAMConfig(false);
  };

  return (
    <AlertingPageWrapper pageId="alerting-admin">
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      {alertManagerSourceName && (
        <>
          <Button disabled={loading} variant="destructive" onClick={() => setShowConfirmDeleteAMConfig(true)}>
            Reset Alertmanager configuration
          </Button>
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
    </AlertingPageWrapper>
  );
}
