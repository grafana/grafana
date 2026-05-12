import { renderHook, waitFor } from '@testing-library/react';

import { useAppPluginEnabled } from './hooks';
import { getAppPluginEnabled } from './settings';

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
});
