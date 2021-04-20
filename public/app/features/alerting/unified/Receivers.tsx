import { Field, InfoBox, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { TemplatesTable } from './components/receivers/TemplatesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

const Receivers: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const config = useUnifiedAlertingSelector((state) => state.amConfigs);

  useEffect(() => {
    dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = config[alertManagerSourceName] || initialAsyncRequestState;

  return (
    <AlertingPageWrapper pageId="receivers">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {error && !loading && (
        <InfoBox severity="error" title={<h4>Error loading alert manager config</h4>}>
          {error.message || 'Unknown error.'}
        </InfoBox>
      )}
      {loading && <LoadingPlaceholder text="loading receivers..." />}
      {result && !loading && !error && <TemplatesTable config={result} />}
    </AlertingPageWrapper>
  );
};

export default Receivers;
