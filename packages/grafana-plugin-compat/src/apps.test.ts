import { type PluginMeta } from '@grafana/data';
import { type BackendSrv, setBackendSrv } from '@grafana/runtime';
import {
  getPluginSettings as runtimeGetPluginSettings,
  updateAppPluginSettings as runtimeUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

import { getPluginSettings, updatePluginSettings } from './apps';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
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

const mockRuntimeGetAppPluginSettings = jest.mocked(runtimeGetPluginSettings);
const mockRuntimeUpdateAppPluginSettings = jest.mocked(runtimeUpdateAppPluginSettings);
const mockId = 'grafana-exploretraces-app';
const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockRuntimeGetAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
    mockBackendSrv.get = jest.fn().mockResolvedValue(mockData);
  });

  it('should call correct function when getPluginSettings exists', async () => {
    await getPluginSettings(mockId, true);

    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalled();
    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalledWith(mockId, true);
    expect(mockBackendSrv.fetch).not.toHaveBeenCalled();
  });

  it('should call correct function when getPluginSettings does not exists', async () => {
    await getPluginSettings(mockId, true, null as unknown as typeof runtimeGetPluginSettings);

    expect(mockRuntimeGetAppPluginSettings).not.toHaveBeenCalled();
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
    await getPluginSettings(mockId, undefined, null as unknown as typeof runtimeGetPluginSettings);

    expect(mockRuntimeGetAppPluginSettings).not.toHaveBeenCalled();
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

describe('updatePluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockRuntimeUpdateAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
    mockBackendSrv.post = jest.fn().mockResolvedValue(mockData);
    mockBackendSrv.get = jest.fn().mockResolvedValue(mockData);
  });

  it('should call correct function when updateAppPluginSettings exists', async () => {
    await updatePluginSettings(mockId, mockData);

    expect(mockRuntimeUpdateAppPluginSettings).toHaveBeenCalled();
    expect(mockRuntimeUpdateAppPluginSettings).toHaveBeenCalledWith(mockId, { ...mockData });
    expect(mockBackendSrv.fetch).not.toHaveBeenCalled();
  });

  it('should return correct response when updateAppPluginSettings exists', async () => {
    const result = await updatePluginSettings(mockId, mockData);

    expect(result).toStrictEqual(mockData);
  });

  it('should call correct function when updateAppPluginSettings does not exists', async () => {
    await updatePluginSettings(mockId, mockData, null as unknown as typeof runtimeUpdateAppPluginSettings);

    expect(mockRuntimeUpdateAppPluginSettings).not.toHaveBeenCalled();
    expect(mockBackendSrv.post).toHaveBeenCalled();
    expect(mockBackendSrv.post).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/settings`,
      { ...mockData },
      { validatePath: true }
    );
  });

  it('should return correct response when updateAppPluginSettings does not exists', async () => {
    const result = await updatePluginSettings(
      mockId,
      mockData,
      null as unknown as typeof runtimeUpdateAppPluginSettings
    );

    expect(result).toStrictEqual(mockData);
  });
});
