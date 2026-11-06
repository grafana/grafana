import { type PluginMeta } from '@grafana/data';
import { type BackendSrv, setBackendSrv } from '@grafana/runtime';

import { getAppPluginHealth, getPluginSettings, updateAppPluginSettings } from './apps';
import { getMockedBackendSrv } from './utils/mocks';

jest.mock('@grafana/runtime/unstable', () => ({
  getPluginSettings: undefined,
  updateAppPluginSettings: undefined,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginSettings: undefined,
  updateAppPluginSettings: undefined,
  getAppPluginHealth: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();

const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
  });

  it('should call correct function when getPluginSettings does not exist', async () => {
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

  it('should default to showErrorAlert === false when getPluginSettings does not exist', async () => {
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

  it('should call correct function when updateAppPluginSettings does not exist', async () => {
    await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(mockBackendSrv.post).toHaveBeenCalled();
    expect(mockBackendSrv.post).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/settings`,
      { ...mockData },
      { validatePath: true }
    );
  });

  it('should return correct response when updateAppPluginSettings does not exist', async () => {
    const result = await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(result).toStrictEqual(mockData);
  });

  it('should reject when getBackendSrv is not setup', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(updateAppPluginSettings('grafana-exploretraces-app', mockData)).rejects.toThrow();
  });
});

describe('getAppPluginHealth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockBackendSrv.get = jest.fn().mockResolvedValue({});
  });

  it('should call correct function when getAppPluginHealth does not exist', async () => {
    await getAppPluginHealth('grafana-exploretraces-app', true);

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/health`,
      undefined,
      undefined,
      {
        showErrorAlert: true,
        validatePath: true,
      }
    );
  });

  it('should default to showErrorAlert === false when getAppPluginHealth does not exist', async () => {
    await getAppPluginHealth('grafana-exploretraces-app');

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/plugins/grafana-exploretraces-app/health`,
      undefined,
      undefined,
      {
        showErrorAlert: false,
        validatePath: true,
      }
    );
  });

  it('should return an unhealthy health result with details', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 400,
      data: { status: 'ERROR', message: 'Invalid credentials', details: { reason: 'credentials' } },
    });

    const response = await getAppPluginHealth('grafana-exploretraces-app');

    expect(response).toEqual({ status: 'ERROR', message: 'Invalid credentials', details: { reason: 'credentials' } });
  });

  it('should return an unknown health result', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 400,
      data: { status: 'UNKNOWN', message: 'Health unknown' },
    });

    const response = await getAppPluginHealth('grafana-exploretraces-app');

    expect(response).toEqual({ status: 'UNKNOWN', message: 'Health unknown' });
  });

  it('should reject a bad request without a health result', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 400,
      data: { message: 'Bad request' },
    });

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
      status: 400,
      data: { message: 'Bad request' },
    });
  });

  it('should reject a server failure with a health-shaped payload', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 500,
      data: { status: 'ERROR', message: 'Backend failed' },
    });

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
      status: 500,
      data: { status: 'ERROR', message: 'Backend failed' },
    });
  });

  it('should reject unauthorized requests and mark them handled', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 401,
      data: { message: 'Unauthorized' },
    });

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
      status: 401,
      data: { message: 'Unauthorized' },
      isHandled: true,
    });
  });

  it('should reject forbidden requests and mark them handled', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 403,
      data: { message: 'Forbidden' },
    });

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
      status: 403,
      data: { message: 'Forbidden' },
      isHandled: true,
    });
  });

  it('should reject thrown error if error status is not 403 or 401', async () => {
    const error = { status: 404, message: 'Not found' };
    mockBackendSrv.get = jest.fn().mockRejectedValue(error);

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
      status: 404,
      message: 'Not found',
    });
  });

  it('should reject when getBackendSrv is not setup', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toThrow();
  });
});
