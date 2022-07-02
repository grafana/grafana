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
    getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
    // act
    const response = await getPluginSettings('test');
    // assert
    expect(response).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
    expect(getRequestSpy).toHaveBeenCalledWith('/api/plugins/test/settings');
  });

  it('should fetch settings from cache when it has a hit', async () => {
    // arrange
    const testPluginResponse = {
      name: 'TestPlugin',
      type: 'datasource',
      id: 'test-plugin',
      enabled: true,
    };
    getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
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
    getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');

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
    getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');
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
    getBackendSrv().get = jest.fn().mockResolvedValue(testPluginResponse);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');

    // act
    const response1 = await getPluginSettings('test');
    await clearPluginSettingsCache();
    const response2 = await getPluginSettings('test');

    // assert
    expect(response1).toEqual(testPluginResponse);
    expect(response2).toEqual(testPluginResponse);
    expect(getRequestSpy).toHaveBeenCalledTimes(2);
  });
});
