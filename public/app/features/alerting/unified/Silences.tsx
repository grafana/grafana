import { Field, Alert, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchSilencesAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

const Silences: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const silences = useUnifiedAlertingSelector((state) => state.silences);

  useEffect(() => {
    dispatch(fetchSilencesAction(alertManagerSourceName));
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
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !loading && !error && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </AlertingPageWrapper>
  );
};

export default Silences;
