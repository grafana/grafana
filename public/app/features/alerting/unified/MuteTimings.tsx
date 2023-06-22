import React, { useCallback, useEffect } from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';

import { Alert } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import MuteTimingForm from './components/mute-timings/MuteTimingForm';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

const MuteTimings = () => {
  const [queryParams] = useQueryParams();
  const dispatch = useDispatch();
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName] = useAlertManagerSourceName(alertManagers);

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

  const config = result?.alertmanager_config;

  const getMuteTimingByName = useCallback(
    (id: string): MuteTimeInterval | undefined => {
      const timing = config?.mute_time_intervals?.find(({ name }: MuteTimeInterval) => name === id);

      if (timing) {
        const provenance = (config?.muteTimeProvenances ?? {})[timing.name];

        return {
          ...timing,
          provenance,
        };
      }

      return timing;
    },
    [config]
  );

  return (
    <>
      {error && !loading && !result && (
        <Alert severity="error" title={`Error loading Alertmanager config for ${alertManagerSourceName}`}>
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {result && !error && (
        <Switch>
          <Route exact path="/alerting/routes/mute-timing/new">
            <MuteTimingForm loading={loading} />
          </Route>
          <Route exact path="/alerting/routes/mute-timing/edit">
            {() => {
              if (queryParams['muteName']) {
                const muteTiming = getMuteTimingByName(String(queryParams['muteName']));
                const provenance = muteTiming?.provenance;

                return (
                  <MuteTimingForm
                    loading={loading}
                    muteTiming={muteTiming}
                    showError={!muteTiming && !loading}
                    provenance={provenance}
                  />
                );
              }
              return <Redirect to="/alerting/routes" />;
            }}
          </Route>
        </Switch>
      )}
    </>
  );
};

export default MuteTimings;
