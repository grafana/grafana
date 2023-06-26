import React, { useCallback, useEffect } from 'react';
import { Route, RouteChildrenProps, Switch } from 'react-router-dom';

import { Alert, withErrorBoundary } from '@grafana/ui';
import { Silence } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { featureDiscoveryApi } from './api/featureDiscoveryApi';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import SilencesEditor from './components/silences/SilencesEditor';
import SilencesTable from './components/silences/SilencesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useSilenceNavData } from './hooks/useSilenceNavData';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { AsyncRequestState, initialAsyncRequestState } from './utils/redux';

const Silences = () => {
  const [alertManagerSourceName] = useAlertManagerSourceName({ withPermissions: 'instance' });

  const dispatch = useDispatch();
  const silences = useUnifiedAlertingSelector((state) => state.silences);
  const alertsRequests = useUnifiedAlertingSelector((state) => state.amAlerts);
  const alertsRequest = alertManagerSourceName
    ? alertsRequests[alertManagerSourceName] || initialAsyncRequestState
    : undefined;

  const { currentData: amFeatures } = featureDiscoveryApi.useDiscoverAmFeaturesQuery(
    { amSourceName: alertManagerSourceName ?? '' },
    { skip: !alertManagerSourceName }
  );

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

  const mimirLazyInitError =
    error?.message?.includes('the Alertmanager is not configured') && amFeatures?.lazyConfigInit;

  if (!alertManagerSourceName) {
    return null;
  }

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={alertManagerSourceName} />

      {mimirLazyInitError && (
        <Alert title="The selected Alertmanager has no configuration" severity="warning">
          Create a new contact point to create a configuration using the default values or contact your administrator to
          set up the Alertmanager.
        </Alert>
      )}
      {error && !loading && !mimirLazyInitError && (
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {alertsRequest?.error && !alertsRequest?.loading && !mimirLazyInitError && (
        <Alert severity="error" title="Error loading Alertmanager alerts">
          {alertsRequest.error?.message || 'Unknown error.'}
        </Alert>
      )}
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
    </>
  );
};

function SilencesPage() {
  const pageNav = useSilenceNavData();

  return (
    <AlertingPageWrapper pageId="silences" pageNav={pageNav} includeAlertmanagerSelector>
      <Silences />
    </AlertingPageWrapper>
  );
}

export default withErrorBoundary(SilencesPage, { style: 'page' });
