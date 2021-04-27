import { Alert, Field, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

const AmRoutes: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/routes" />;
  }

  return (
    <AlertingPageWrapper pageId="am-routes">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      <br />
      <br />
      {error && !loading && (
        <Alert severity="error" title="Error loading alert manager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading alert manager config..." />}
      {result && !loading && !error && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </AlertingPageWrapper>
  );
};

export default AmRoutes;
