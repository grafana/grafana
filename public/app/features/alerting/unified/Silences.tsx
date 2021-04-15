import { Field, InfoBox, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchSilencesAction, fetchAllPromAndRulerRulesAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';
import SilencesTable from './components/silences/SilencesTable';
import { getRulesDataSources } from './utils/datasource';

const Silences: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const rulesDataSources = useMemo(getRulesDataSources, []);

  const silences = useUnifiedAlertingSelector((state) => state.silences);
  const promRules = useUnifiedAlertingSelector((state) => state.promRules);

  useEffect(() => {
    dispatch(fetchSilencesAction(alertManagerSourceName));
    dispatch(fetchAllPromAndRulerRulesAction());
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = silences[alertManagerSourceName] || initialAsyncRequestState;
  const dataSourcesLoading = useMemo(() => rulesDataSources.some((ds) => promRules[ds.name]?.loading), [
    promRules,
    rulesDataSources,
  ]);

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
      {(loading || dataSourcesLoading) && <LoadingPlaceholder text="loading silences..." />}
      {result && !loading && !error && !dataSourcesLoading && <SilencesTable silences={result} />}
    </AlertingPageWrapper>
  );
};

export default Silences;
