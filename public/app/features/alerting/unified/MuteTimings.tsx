import React, { useCallback, useEffect, useState } from 'react';
import { Route, Redirect, Switch, useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import MuteTimingForm from './components/mute-timings/MuteTimingForm';
import { useAlertmanagerConfig } from './hooks/useAlertmanagerConfig';
import { useAlertmanager } from './state/AlertmanagerContext';

const MuteTimings = () => {
  const [queryParams] = useQueryParams();
  const { selectedAlertmanager } = useAlertmanager();
  const { currentData, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;

  const getMuteTimingByName = useCallback(
    (id: string): MuteTimeInterval | undefined => {
      const timing = config?.mute_time_intervals?.find(({ name }: MuteTimeInterval) => name === id);

      if (timing) {
        const provenance = config?.muteTimeProvenances?.[timing.name];

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
      {error && !isLoading && !currentData && (
        <Alert severity="error" title={`Error loading Alertmanager config for ${selectedAlertmanager}`}>
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {currentData && !error && (
        <Switch>
          <Route exact path="/alerting/routes/mute-timing/new">
            <MuteTimingForm loading={isLoading} />
          </Route>
          <Route exact path="/alerting/routes/mute-timing/edit">
            {() => {
              if (queryParams['muteName']) {
                const muteTiming = getMuteTimingByName(String(queryParams['muteName']));
                const provenance = muteTiming?.provenance;

                return (
                  <MuteTimingForm
                    loading={isLoading}
                    muteTiming={muteTiming}
                    showError={!muteTiming && !isLoading}
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

const MuteTimingsPage = () => {
  const pageNav = useMuteTimingNavData();

  return (
    <AlertmanagerPageWrapper pageId="am-routes" pageNav={pageNav} accessType="notification">
      <MuteTimings />
    </AlertmanagerPageWrapper>
  );
};

export function useMuteTimingNavData() {
  const { isExact, path } = useRouteMatch();
  const [pageNav, setPageNav] = useState<Pick<NavModelItem, 'id' | 'text' | 'icon'> | undefined>();

  useEffect(() => {
    if (path === '/alerting/routes/mute-timing/new') {
      setPageNav({
        id: 'alert-policy-new',
        text: 'Add mute timing',
      });
    } else if (path === '/alerting/routes/mute-timing/edit') {
      setPageNav({
        id: 'alert-policy-edit',
        text: 'Edit mute timing',
      });
    }
  }, [path, isExact]);

  return pageNav;
}

export default MuteTimingsPage;
