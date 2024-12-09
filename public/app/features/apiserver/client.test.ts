import { getBackendSrv } from '@grafana/runtime';

import { DatasourceAPIVersions } from './client';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
  config: {},
}));

describe('DatasourceAPIVersions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('get', async () => {
    const getMock = jest.fn().mockResolvedValue({
      groups: [
        { name: 'testdata.datasource.grafana.app', preferredVersion: { version: 'v1' } },
        { name: 'prometheus.datasource.grafana.app', preferredVersion: { version: 'v2' } },
        { name: 'myorg-myplugin.datasource.grafana.app', preferredVersion: { version: 'v3' } },
      ],
    });
    getBackendSrv().get = getMock;
    const apiVersions = new DatasourceAPIVersions();
    expect(await apiVersions.get('testdata')).toBe('v1');
    expect(await apiVersions.get('grafana-testdata-datasource')).toBe('v1');
    expect(await apiVersions.get('prometheus')).toBe('v2');
    expect(await apiVersions.get('graphite')).toBeUndefined();
    expect(await apiVersions.get('myorg-myplugin-datasource')).toBe('v3');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/apis');
  });
});
