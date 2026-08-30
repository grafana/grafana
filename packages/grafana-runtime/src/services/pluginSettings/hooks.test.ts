import { renderHook, waitFor } from '@testing-library/react';

import { PluginType, type PluginMeta } from '@grafana/data';

import { getPluginSettings } from './getPluginSettings';
import { useAppPluginEnabled, usePluginSettings } from './hooks';
import { getAppPluginEnabled } from './settings';

jest.mock('./getPluginSettings', () => ({
  ...jest.requireActual('./getPluginSettings'),
  getPluginSettings: jest.fn(),
}));

const getPluginSettingsMock = jest.mocked(getPluginSettings);

jest.mock('./settings', () => ({
  ...jest.requireActual('./settings.ts'),
  getAppPluginEnabled: jest.fn(),
}));

const getAppPluginEnabledMock = jest.mocked(getAppPluginEnabled);

describe('hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useAppPluginEnabled', () => {
    it('should return correct default values', async () => {
      getAppPluginEnabledMock.mockResolvedValue(true);

      const { result } = renderHook(() => useAppPluginEnabled('myorg-test-app'));

      expect(result.current.loading).toEqual(true);
      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toBeUndefined();

      // because of Warning: An update to TestComponent inside a test was not wrapped in act(...).
      await waitFor(() => expect(result.current.loading).toEqual(true));
    });

    it('should return correct values after loading', async () => {
      getAppPluginEnabledMock.mockResolvedValue(true);

      const { result } = renderHook(() => useAppPluginEnabled('myorg-test-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.loading).toEqual(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toBe(true);
    });

    it('should return correct values if the pluginId does not exist', async () => {
      getAppPluginEnabledMock.mockResolvedValue(false);

      const { result } = renderHook(() => useAppPluginEnabled('otherorg-otherplugin-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.loading).toEqual(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toEqual(false);
    });

    it('should return correct values if isAppPluginEnabled throws', async () => {
      getAppPluginEnabledMock.mockRejectedValue(new Error('Some error'));

      const { result } = renderHook(() => useAppPluginEnabled('otherorg-otherplugin-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.loading).toEqual(false);
      expect(result.current.error).toStrictEqual(new Error('Some error'));
      expect(result.current.value).toBeUndefined();
    });
  });

  describe('usePluginSettings', () => {
    const mockPluginMeta: PluginMeta = {
      id: 'myorg-test-app',
      name: 'Test App',
      type: PluginType.app,
      module: '',
      baseUrl: '',
      info: {
        author: { name: 'John Doe' },
        description: 'This is my test app',
        links: [],
        logos: { large: 'logo-large.png', small: 'logo-small.png' },
        screenshots: [],
        updated: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    it('should return loading state initially', async () => {
      getPluginSettingsMock.mockResolvedValue(mockPluginMeta);

      const { result } = renderHook(() => usePluginSettings('myorg-test-app'));

      expect(result.current.loading).toEqual(true);
      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toBeUndefined();

      // suppress act() warning
      await waitFor(() => expect(result.current.loading).toEqual(false));
    });

    it('should return the plugin meta after loading', async () => {
      getPluginSettingsMock.mockResolvedValue(mockPluginMeta);

      const { result } = renderHook(() => usePluginSettings('myorg-test-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toStrictEqual(mockPluginMeta);
    });

    it('should return undefined value without error when pluginId is empty', async () => {
      const { result } = renderHook(() => usePluginSettings(''));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toBeUndefined();
      expect(getPluginSettingsMock).not.toHaveBeenCalled();
    });

    it('should return undefined value without error on a 404', async () => {
      // getPluginSettings wraps fetch errors as: new Error('Unknown Plugin', { cause: fetchError })
      const fetchError = { status: 404, data: {} };
      getPluginSettingsMock.mockRejectedValue(new Error('Unknown Plugin', { cause: fetchError }));

      const { result } = renderHook(() => usePluginSettings('myorg-test-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.error).toBeUndefined();
      expect(result.current.value).toBeUndefined();
    });

    it('should surface non-404 errors via the error field', async () => {
      const fetchError = { status: 500, data: {} };
      const thrownError = new Error('Unknown Plugin', { cause: fetchError });
      getPluginSettingsMock.mockRejectedValue(thrownError);

      const { result } = renderHook(() => usePluginSettings('myorg-test-app'));

      await waitFor(() => expect(result.current.loading).toEqual(false));

      expect(result.current.error).toStrictEqual(thrownError);
      expect(result.current.value).toBeUndefined();
    });
  });
});
