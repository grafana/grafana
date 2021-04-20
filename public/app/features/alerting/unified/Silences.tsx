import { Field, InfoBox, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
import SilencesTable from './components/silences/SilencesTable';

const Silences: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
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

  const { result, loading, error } = silences[alertManagerSourceName] || initialAsyncRequestState;

  return (
    <AlertingPageWrapper pageId="silences">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      <br />
      <br />
      {error && !loading && (
        <InfoBox severity="error" title={<h4>Error loading silences</h4>}>
          {error.message || 'Unknown error.'}
        </InfoBox>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !error && <SilencesTable silences={result} />}
      {result && !error && alerts.result && (
        <>
          Alerts:
          <pre>{JSON.stringify(alerts.result, null, 2)}</pre>
        </>
      )}
    </AlertingPageWrapper>
  );
};

export default Silences;
