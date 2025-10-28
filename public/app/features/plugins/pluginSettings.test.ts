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

  it('should reject with Unknown Plugin message if error status is not 403 or 401', async () => {
    const error = { status: 404, message: 'Not found' };
    jest.spyOn(getBackendSrv(), 'get').mockRejectedValue(error);

    await expect(getPluginSettings('test')).rejects.toEqual(new Error('Unknown Plugin'));
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
});
