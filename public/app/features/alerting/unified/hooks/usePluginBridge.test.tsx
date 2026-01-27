import { renderHook, waitFor } from '@testing-library/react';

import { useGetPluginSettingsQuery } from '../api/pluginsApi';
import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { useIrmPlugin } from './usePluginBridge';

jest.mock('../api/pluginsApi');

const mockedUseGetPluginSettingsQuery = jest.mocked(useGetPluginSettingsQuery);

type PluginQueryResult = ReturnType<typeof useGetPluginSettingsQuery>;

describe('useIrmPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return IRM plugin ID when IRM plugin is installed', async () => {
    mockedUseGetPluginSettingsQuery.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return {
          data: pluginMeta[SupportedPlugin.Irm],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      if (pluginId === SupportedPlugin.OnCall) {
        return {
          data: { ...pluginMeta[SupportedPlugin.OnCall], enabled: false },
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Plugin not found'),
        refetch: jest.fn(),
      } as PluginQueryResult;
    });

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return OnCall plugin ID when IRM plugin is not installed', async () => {
    mockedUseGetPluginSettingsQuery.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.OnCall) {
        return {
          data: pluginMeta[SupportedPlugin.OnCall],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Plugin not found'),
        refetch: jest.fn(),
      } as PluginQueryResult;
    });

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return Incident plugin ID when IRM plugin is not installed', async () => {
    mockedUseGetPluginSettingsQuery.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Incident) {
        return {
          data: pluginMeta[SupportedPlugin.Incident],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Plugin not found'),
        refetch: jest.fn(),
      } as PluginQueryResult;
    });

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.Incident));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Incident);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return loading state while fetching plugins', () => {
    mockedUseGetPluginSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
      refetch: jest.fn(),
    } as PluginQueryResult);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    expect(result.current.loading).toBe(true);
    expect(result.current.installed).toBeUndefined();
  });

  it('should return installed undefined when neither plugin is installed', async () => {
    mockedUseGetPluginSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Plugin not found'),
      refetch: jest.fn(),
    } as PluginQueryResult);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBeUndefined();
  });

  it('should return IRM plugin ID when both IRM and OnCall are installed', async () => {
    mockedUseGetPluginSettingsQuery.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return {
          data: pluginMeta[SupportedPlugin.Irm],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      if (pluginId === SupportedPlugin.OnCall) {
        return {
          data: pluginMeta[SupportedPlugin.OnCall],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Plugin not found'),
        refetch: jest.fn(),
      } as PluginQueryResult;
    });

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toEqual(pluginMeta[SupportedPlugin.Irm]);
  });

  it('should return IRM plugin ID when both IRM and Incident are installed', async () => {
    mockedUseGetPluginSettingsQuery.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return {
          data: pluginMeta[SupportedPlugin.Irm],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      if (pluginId === SupportedPlugin.Incident) {
        return {
          data: pluginMeta[SupportedPlugin.Incident],
          isLoading: false,
          error: undefined,
          refetch: jest.fn(),
        } as PluginQueryResult;
      }
      return {
        data: undefined,
        isLoading: false,
        error: new Error('Plugin not found'),
        refetch: jest.fn(),
      } as PluginQueryResult;
    });

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.Incident));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toEqual(pluginMeta[SupportedPlugin.Irm]);
  });
});
