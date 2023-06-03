import { renderHook } from '@testing-library/react-hooks';
import { of } from 'rxjs';

import { FetchResponse, getBackendSrv, setBackendSrv } from '@grafana/runtime/src';

import { getMockDS, getMockDSInstanceSettings } from '../../../../../specs/mocks';

import { useAllTagKeys } from './useAllTagKeys';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('useAllTagKeys', () => {
  it('should return all tag keys', async () => {
    const instanceSettings = getMockDSInstanceSettings();
    const datasource = getMockDS(instanceSettings);
    const fetchMock = jest.fn().mockImplementation((dd) => {
      if (dd.data.queries[0].query === 'SHOW FIELD KEYS') {
        return of(fieldKeysResponse as FetchResponse);
      } else if (dd.data.queries[0].query === 'SHOW TAG KEYS') {
        return of(tagKeysResponse as FetchResponse);
      } else {
        return of({});
      }
    });
    const origBackendSrv = getBackendSrv();
    setBackendSrv({
      ...origBackendSrv,
      fetch: fetchMock,
    });

    const { result } = renderHook(() => useAllTagKeys(datasource));
    const allTagKeys = await result.current.allTagKeys;
    expect(allTagKeys.size).toBeGreaterThan(0);
    expect(allTagKeys.has('hostname::tag')).toBeTruthy();
    expect(allTagKeys.has('datacenter::tag')).toBeTruthy();
  });
});

const tagKeysResponse = {
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
            data: { values: [['datacenter', 'geohash', 'hostname', 'latitude', 'longitude', 'source']] },
          },
          {
            schema: {
              name: 'logins.count',
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: { values: [['datacenter', 'geohash', 'hostname', 'latitude', 'longitude', 'source']] },
          },
          {
            schema: {
              name: 'logs',
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: { values: [['server', 'type']] },
          },
        ],
      },
    },
  },
};

const fieldKeysResponse = {
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
            data: { values: [['value']] },
          },
          {
            schema: {
              name: 'derivative',
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: { values: [['value']] },
          },
        ],
      },
    },
  },
};
