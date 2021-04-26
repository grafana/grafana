import { Field, Alert, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { ReceiversTable } from './components/receivers/ReceiversTable';
import { TemplatesTable } from './components/receivers/TemplatesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction, fetchGrafanaNotifiersAction } from './state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

const Receivers: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const config = useUnifiedAlertingSelector((state) => state.amConfigs);
  const receiverTypes = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  useEffect(() => {
    dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME && !(receiverTypes.result || receiverTypes.loading)) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [alertManagerSourceName, dispatch, receiverTypes]);

  const { result, loading, error } = config[alertManagerSourceName] || initialAsyncRequestState;

  return (
    <AlertingPageWrapper pageId="receivers">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {error && !loading && (
        <Alert severity="error" title="Error loading alert manager config">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading receivers..." />}
      {result && !loading && !error && (
        <>
          <TemplatesTable config={result} />
          <ReceiversTable config={result} />
        </>
      )}
    </AlertingPageWrapper>
  );
};

export default Receivers;
