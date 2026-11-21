import { renderHook, waitFor } from '@testing-library/react';

import { useRulesSourceDataSources } from './hooks';
import { getRulesSourceDataSources } from './rulesSources';
import { DataSourceInstanceSettingsFactory, setupDataSources } from './testSetup/DataSources';

describe('getRulesSourceDataSources', () => {
  beforeEach(() => {
    setupDataSources(
      DataSourceInstanceSettingsFactory.build({
        uid: 'prom',
        name: 'prom',
        type: 'prometheus',
        url: '/api/datasources/proxy/uid/prom',
        jsonData: { manageAlerts: false },
      }),
      DataSourceInstanceSettingsFactory.build({ uid: 'loki', name: 'loki', type: 'loki', url: '' }),
      DataSourceInstanceSettingsFactory.build({ uid: 'graphite', name: 'graphite', type: 'graphite' })
    );
  });

  it('returns the same data sources as useRulesSourceDataSources', async () => {
    const { result } = renderHook(() => useRulesSourceDataSources());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(await getRulesSourceDataSources()).toEqual(result.current.items);
  });

  it('copies the url of each data source from its settings', async () => {
    const dataSources = await getRulesSourceDataSources();

    expect(dataSources.map(({ uid, url }) => ({ uid, url }))).toEqual(
      expect.arrayContaining([
        { uid: 'prom', url: '/api/datasources/proxy/uid/prom' },
        { uid: 'loki', url: '' },
      ])
    );
    expect(dataSources).toHaveLength(2);
  });
});
