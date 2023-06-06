import { renderHook } from '@testing-library/react-hooks';

import config from 'app/core/config';

import { getMockDS, getMockDSInstanceSettings, mockBackendService } from '../../../../../specs/mocks';

import { useRetentionPolicies } from './useRetentionPolicies';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('useRetentionPolicies', () => {
  it('should return all policies when influxdbBackendMigration feature toggle enabled', async () => {
    const instanceSettings = getMockDSInstanceSettings();
    const datasource = getMockDS(instanceSettings);
    mockBackendService(response);

    config.featureToggles.influxdbBackendMigration = true;
    const { result, waitForNextUpdate } = renderHook(() => useRetentionPolicies(datasource));
    await waitForNextUpdate();
    expect(result.current.retentionPolicies.length).toEqual(4);
    expect(result.current.retentionPolicies[0]).toEqual('autogen');
  });
});

const response = {
  data: {
    results: {
      metadataQuery: {
        status: 200,
        frames: [
          {
            schema: {
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: { values: [['autogen', 'bar', '5m_avg', '1m_avg']] },
          },
        ],
      },
    },
  },
};
