import React, { FC, useEffect, useCallback } from 'react';
import { Alert, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';

import { useDispatch } from 'react-redux';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import SilencesTable from './components/silences/SilencesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { AsyncRequestState, initialAsyncRequestState } from './utils/redux';
import SilencesEditor from './components/silences/SilencesEditor';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { Silence } from 'app/plugins/datasource/alertmanager/types';

const Silences: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const silences = useUnifiedAlertingSelector((state) => state.silences);
  const alertsRequests = useUnifiedAlertingSelector((state) => state.amAlerts);
  const alertsRequest = alertManagerSourceName
    ? alertsRequests[alertManagerSourceName] || initialAsyncRequestState
    : undefined;

  const location = useLocation();
  const isRoot = location.pathname.endsWith('/alerting/silences');

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

  const { result, loading, error }: AsyncRequestState<Silence[]> =
    (alertManagerSourceName && silences[alertManagerSourceName]) || initialAsyncRequestState;

  const getSilenceById = useCallback((id: string) => result && result.find((silence) => silence.id === id), [result]);

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/silences" />;
  }

  return (
    <AlertingPageWrapper pageId="silences">
      <AlertManagerPicker disabled={!isRoot} current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      {error && !loading && (
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {alertsRequest?.error && !alertsRequest?.loading && (
        <Alert severity="error" title="Error loading alert manager alerts">
          {alertsRequest.error?.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !error && (
        <Switch>
          <Route exact path="/alerting/silences">
            <SilencesTable
              silences={result}
              alertManagerAlerts={alertsRequest?.result ?? []}
              alertManagerSourceName={alertManagerSourceName}
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

export default withErrorBoundary(Silences, { style: 'page' });
