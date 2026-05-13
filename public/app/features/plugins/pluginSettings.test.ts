import { getBackendSrv } from '@grafana/runtime';

import { getPluginSettings, clearPluginSettingsCache } from './pluginSettings';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
}));

describe('PluginSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPluginSettingsCache();
  });

  it('should fetch settings when cache is empty', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };

    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue(testPluginResponse);
    // act
    const response = await getPluginSettings('test');
    // assert
    expect(response).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
    expect(getRequestSpy).toHaveBeenCalledWith('/api/plugins/test/settings', undefined, undefined, {
      validatePath: true,
    });
  });

  it('should fetch settings from cache when it has a hit', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue(testPluginResponse);
    // act
    const response1 = await getPluginSettings('test');
    const response2 = await getPluginSettings('test');

    // assert
    expect(response1).toEqual(testPluginResponse);
    expect(response2).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('should refetch from backend when cache is cleared', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };

    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue(testPluginResponse);

    // act
    const response1 = await getPluginSettings('test');
    await clearPluginSettingsCache('test');
    const response2 = await getPluginSettings('test');

    // assert
    expect(response1).toEqual(testPluginResponse);
    expect(response2).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(2);
  });
  it('should fetch from cache when it is cleared for another plugin setting', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue(testPluginResponse);
    // act
    const response1 = await getPluginSettings('test');
    await clearPluginSettingsCache('another-test');
    const response2 = await getPluginSettings('test');

    // assert
    expect(response1).toEqual(testPluginResponse);
    expect(response2).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
  });
  it('should clear all cache when no plugin id is provided to the clear function', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };

    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get').mockResolvedValue(testPluginResponse);

    // act
    const response1 = await getPluginSettings('test');
    await clearPluginSettingsCache();
    const response2 = await getPluginSettings('test');

    // assert
    expect(response1).toEqual(testPluginResponse);
    expect(response2).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(2);
  });

  it('should preserve a 404 FetchError shape so callers can discriminate "plugin not installed"', async () => {
    const error = { status: 404, message: 'Not found' };
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(error);

    // The previous behaviour wrapped 404 in `new Error('Unknown Plugin')`, which discarded the status
    // and prevented downstream code (e.g. AppRootPage's onboarding fallback) from telling a 404 apart
    // from a real backend failure.
    await expect(getPluginSettings('test')).rejects.toEqual(error);
  });

  it('should preserve a 5xx FetchError shape (no isHandled mark)', async () => {
    const error = { status: 500, message: 'Internal Server Error' };
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(error);

    await expect(getPluginSettings('test')).rejects.toEqual(error);
  });

  it('should reject thrown error if error status is 403', async () => {
    const error = { status: 403, message: 'Forbidden' };
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(error);

    await expect(getPluginSettings('test')).rejects.toEqual({ ...error, isHandled: true });
  });

  it('should reject thrown error if error status is 401', async () => {
    const error = { status: 401, message: 'Unauthorized' };
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(error);

    await expect(getPluginSettings('test')).rejects.toEqual({ ...error, isHandled: true });
  });

  it('should fall back to the opaque "Unknown Plugin" Error for status-less rejections', async () => {
    // Network error / JSON parse failure / similar — no status field. Keep the legacy shape so
    // pre-existing callers that don't read status keep working.
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(new TypeError('NetworkError'));

    await expect(getPluginSettings('test')).rejects.toEqual(new Error('Unknown Plugin'));
  });
});
