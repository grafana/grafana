import React, { FC, useEffect, useCallback } from 'react';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { useDispatch } from 'react-redux';
import { Redirect, Route, RouteChildrenProps, Switch } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import SilencesTable from './components/silences/SilencesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
import SilencesEditor from './components/silences/SilencesEditor';

const Silences: FC = () => {
  const [alertManagerSourceName = '', setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const silences = useUnifiedAlertingSelector((state) => state.silences);

  const alerts =
    useUnifiedAlertingSelector((state) => state.amAlerts)[alertManagerSourceName] || initialAsyncRequestState;

  useEffect(() => {
    function fetchAll() {
      if (alertManagerSourceName) {
        dispatch(fetchSilencesAction(alertManagerSourceName));
        dispatch(fetchAmAlertsAction(alertManagerSourceName));
      }
    }
    fetchAll();
    const interval = setInterval(() => fetchAll, SILENCES_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = silences[alertManagerSourceName] || initialAsyncRequestState;
  const getSilenceById = useCallback((id: string) => result && result.find((silence) => silence.id === id), [result]);

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/silences" />;
  }

  return (
    <AlertingPageWrapper pageId="silences">
      {error && !loading && (
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !error && alerts.result && (
        <Switch>
          <Route exact path="/alerting/silences">
            <SilencesTable
              silences={result}
              alertManagerAlerts={alerts.result}
              alertManagerSourceName={alertManagerSourceName}
              setAlertManagerSourceName={setAlertManagerSourceName}
            />
          </Route>
          <Route exact path="/alerting/silence/new">
            <SilencesEditor alertManagerSourceName={alertManagerSourceName} />
          </Route>
          <Route exact path="/alerting/silence/:id/edit">
            {({ match }: RouteChildrenProps<{ id: string }>) => {
              return (
                match?.params.id && (
                  <SilencesEditor
                    silence={getSilenceById(match.params.id)}
                    alertManagerSourceName={alertManagerSourceName}
                  />
                )
              );
            }}
          </Route>
        </Switch>
      )}
    </AlertingPageWrapper>
  );
};

export default Silences;
