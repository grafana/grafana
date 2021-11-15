import React, { useCallback, useEffect } from 'react';
import { Route, RouteChildrenProps, Switch } from 'react-router-dom';
import MuteTimingForm from './components/amroutes/MuteTimingForm';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';
import { AlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

const MuteTimings = () => {
  const dispatch = useDispatch();
  const [alertManagerSourceName] = useAlertManagerSourceName();

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  const fetchConfig = useCallback(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const { result, error, loading } =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config: AlertmanagerConfig = result?.alertmanager_config;

  const getMuteTimingByName = useCallback(
    (id: string) => {
      const decryptedString = atob(id);

      return config?.mute_time_intervals?.find(({ name }) => name === decryptedString);
    },
    [config]
  );

  return (
    <>
      {loading && <LoadingPlaceholder text="Loading mute timing" />}
      {error && !loading && (
        <Alert severity="error" title={`Error loading Alertmanager config for ${alertManagerSourceName}`}>
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {result && !error && (
        <Switch>
          <Route exact path="/alerting/routes/mute-timing/new">
            <MuteTimingForm />
          </Route>
          <Route exact path="/alerting/routes/mute-timing/:id/edit">
            {({ match }: RouteChildrenProps<{ id: string }>) => {
              return match?.params?.id && <MuteTimingForm muteTiming={getMuteTimingByName(match.params.id)} />;
            }}
          </Route>
        </Switch>
      )}
    </>
  );
};

export default MuteTimings;
