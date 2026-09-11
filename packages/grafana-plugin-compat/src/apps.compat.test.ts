import { type PluginMeta } from '@grafana/data';
import { type BackendSrv, setBackendSrv } from '@grafana/runtime';

import { getPluginSettings, updateAppPluginSettings } from './apps';

jest.mock('@grafana/runtime/unstable', () => ({
  getPluginSettings: undefined,
  updateAppPluginSettings: undefined,
}));

const mockBackendSrv: BackendSrv = {
  chunked: jest.fn(),
  delete: jest.fn(),
  fetch: jest.fn(),
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  datasourceRequest: jest.fn(),
  request: jest.fn(),
};

const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
  });

  it('should call correct function when getPluginSettings does not exists', async () => {
    await getPluginSettings('grafana-exploretraces-app', true);

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/settings`,
      undefined,
      undefined,
      {
        showErrorAlert: true,
        validatePath: true,
      }
    );
  });

  it('should default to showErrorAlert === false when getPluginSettings does not exists', async () => {
    await getPluginSettings('grafana-exploretraces-app');

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/settings`,
      undefined,
      undefined,
      {
        showErrorAlert: false,
        validatePath: true,
      }
    );
  });
});

describe('updateAppPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockBackendSrv.post = jest.fn().mockResolvedValue(mockData);
    mockBackendSrv.get = jest.fn().mockResolvedValue(mockData);
  });

  it('should call correct function when updateAppPluginSettings does not exists', async () => {
    await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(mockBackendSrv.post).toHaveBeenCalled();
    expect(mockBackendSrv.post).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/settings`,
      { ...mockData },
      { validatePath: true }
    );
  });

  it('should return correct response when updateAppPluginSettings does not exists', async () => {
    const result = await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(result).toStrictEqual(mockData);
  });
});
