import { Field, Alert, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Redirect } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
import SilencesTable from './components/silences/SilencesTable';

const Silences: FC = () => {
  const [alertManagerSourceName = '', setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const silences = useUnifiedAlertingSelector((state) => state.silences);

  const alerts =
    useUnifiedAlertingSelector((state) => state.amAlerts)[alertManagerSourceName] || initialAsyncRequestState;

  useEffect(() => {
    function fetchAll() {
      dispatch(fetchSilencesAction(alertManagerSourceName));
      dispatch(fetchAmAlertsAction(alertManagerSourceName));
    }
    fetchAll();
    const interval = setInterval(() => fetchAll, SILENCES_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [alertManagerSourceName, dispatch]);

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/silences" />;
  }
  const { result, loading, error } = silences[alertManagerSourceName] || initialAsyncRequestState;

  return (
    <AlertingPageWrapper pageId="silences">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      <br />
      <br />
      {error && !loading && (
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !error && alerts.result && (
        <SilencesTable
          silences={result}
          alertManagerAlerts={alerts.result}
          alertManagerSourceName={alertManagerSourceName}
        />
      )}
    </AlertingPageWrapper>
  );
};

export default Silences;
