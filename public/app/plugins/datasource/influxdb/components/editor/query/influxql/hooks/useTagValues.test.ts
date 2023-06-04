import { renderHook } from '@testing-library/react-hooks';

import { getMockDS, getMockDSInstanceSettings, mockBackendService } from '../../../../../specs/mocks';

import { useTagValues } from './useTagValues';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('useTagValues', () => {
  it('should return tag values', async () => {
    const instanceSettings = getMockDSInstanceSettings();
    const datasource = getMockDS(instanceSettings);
    mockBackendService(response);

    const { result } = renderHook(() =>
      useTagValues(datasource, {
        refId: 'metadataQuery',
        tags: [
          {
            key: 'geohash::tag',
            value: 'we-dont-know-it-yet',
          },
        ],
        measurement: 'cpu',
        policy: 'bar',
      })
    );
    const resp = await result.current.getTagValues('geohash::tag', []);
    expect(resp.length).toEqual(3);
    expect(resp[0]).toEqual('tz6h548nc111');
  });

  it('should return empty array when asked a key ends with ::field', async () => {
    const instanceSettings = getMockDSInstanceSettings();
    const datasource = getMockDS(instanceSettings);
    mockBackendService(response);

    const { result } = renderHook(() =>
      useTagValues(datasource, {
        refId: 'metadataQuery',
        tags: [
          {
            key: 'test::field',
            value: 'we-dont-know-it-yet',
          },
        ],
        measurement: 'cpu',
        policy: 'bar',
      })
    );
    const resp = await result.current.getTagValues('field::field', []);
    expect(resp.length).toEqual(0);
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
              name: 'cpu',
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: { values: [['America']] },
          },
        ],
      },
    },
  },
};
