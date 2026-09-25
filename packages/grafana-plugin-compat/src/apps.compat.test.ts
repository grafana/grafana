import { type PluginMeta } from '@grafana/data';
import { type BackendSrv, setBackendSrv } from '@grafana/runtime';

import { getPluginSettings, updateAppPluginSettings } from './apps';
import { getMockedBackendSrv } from './utils/mocks';

jest.mock('@grafana/runtime/unstable', () => ({
  getPluginSettings: undefined,
  updateAppPluginSettings: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();

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

  it('should reject when getBackendSrv is not setup', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(getPluginSettings('grafana-exploretraces-app')).rejects.toThrow();
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

  it('should reject when getBackendSrv is not setup', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(updateAppPluginSettings('grafana-exploretraces-app', mockData)).rejects.toThrow();
  });
});
