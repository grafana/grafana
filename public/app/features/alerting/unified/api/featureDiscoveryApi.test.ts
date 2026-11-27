import { HttpResponse, http } from 'msw';

import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';
import { PromApplication } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { buildInfoResponse } from '../testSetup/featureDiscovery';

import { featureDiscoveryApi } from './featureDiscoveryApi';

const server = setupMswServer();

type RulesSourceIdentifier = Parameters<typeof featureDiscoveryApi.endpoints.discoverDsFeatures.initiate>[0];

function discover(identifier: RulesSourceIdentifier) {
  const store = configureStore();
  return store.dispatch(featureDiscoveryApi.endpoints.discoverDsFeatures.initiate(identifier));
}

describe('discoverDsFeatures', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
    setupDataSources(
      mockDataSource({ uid: 'mimir', name: 'Mimir', jsonData: { manageAlerts: true } }),
      mockDataSource({ uid: 'not-managing', name: 'Not managing', jsonData: { manageAlerts: false } })
    );
    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
        HttpResponse.json(buildInfoResponse.mimir)
      )
    );
  });

  it.each([{ rulesSourceName: 'Mimir' }, { uid: 'mimir' }])('finds a rules source by %o', async (identifier) => {
    const { data, error } = await discover(identifier);

    expect(error).toBeUndefined();
    expect(data).toMatchObject({ name: 'Mimir', uid: 'mimir', application: PromApplication.Mimir });
  });

  it.each<RulesSourceIdentifier>([{ rulesSourceName: 'grafana' }, { uid: GrafanaRulesSourceSymbol }])(
    'returns the Grafana rules source for %o without the data source list',
    async (identifier) => {
      const { data } = await discover(identifier);

      expect(data).toMatchObject({ name: 'grafana', uid: 'grafana', application: 'grafana' });
    }
  );

  it.each([{ rulesSourceName: 'Not managing' }, { uid: 'not-managing' }, { rulesSourceName: 'Unknown' }])(
    'returns an error for %o, which is not a rules source that manages alerts',
    async (identifier) => {
      const { data, error } = await discover(identifier);

      expect(data).toBeUndefined();
      expect(error).toEqual(new Error(`Unable to find data source for ${JSON.stringify(identifier)}`));
    }
  );

  it('returns an error when the user cannot read data source-managed rules', async () => {
    grantUserPermissions([]);

    const { error } = await discover({ uid: 'mimir' });

    expect(error).toEqual(new Error('Unable to find data source for {"uid":"mimir"}'));
  });
});
