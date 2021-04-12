import { InfoBox, LoadingPlaceholder } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';

const AmRoutes: FC = () => {
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  useEffect(() => {
    dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = amConfigs[alertManagerSourceName] || initialAsyncRequestState;

  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      <br />
      <br />
      {error && !loading && (
        <InfoBox severity="error" title={<h4>Error loading alert manager config</h4>}>
          {error.message || 'Unknown error.'}
        </InfoBox>
      )}
      {loading && <LoadingPlaceholder text="loading alert manager config..." />}
      {result && !loading && !error && (
        <>
          <AmRootRoute route={result.alertmanager_config.route} />
          <AmSpecificRouting
            route={{
              receiver: 'e2e-bogdanmatei1',
              group_by: ['cluster', 'alertname'],
              routes: [
                {
                  receiver: 'database-pager-root',
                  match_re: {
                    service: 'mysql|cassandra',
                    service2: 'asl',
                    service3: 'pls',
                    service4: 'asdfads',
                    service5: 'cassandra',
                  },
                  routes: [
                    {
                      receiver: 'database-pager-child1',
                      match_re: {
                        service: 'mysql',
                      },
                      routes: [
                        {
                          receiver: 'database-pager-subchild1',
                          group_wait: '10s',
                        },
                        {
                          receiver: 'database-pager-subchild2',
                          group_wait: '20m',
                        },
                      ],
                      group_wait: '10s',
                    },
                    {
                      receiver: 'database-pager-child2',
                      match_re: {
                        service: 'cassandra',
                      },
                      group_wait: '20s',
                    },
                  ],
                  group_wait: '10s',
                },
                {
                  receiver: 'frontend-pager',
                  group_by: ['product', 'environment'],
                  match: {
                    team: 'frontend',
                  },
                },
              ],
              group_wait: '30s',
              group_interval: '5m',
              repeat_interval: '4h',
            }}
          />
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </>
      )}
    </AlertingPageWrapper>
  );
};

export default AmRoutes;
