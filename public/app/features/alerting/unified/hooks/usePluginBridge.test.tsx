import { renderHook, waitFor } from '@testing-library/react';

import { getPluginSettings } from 'app/features/plugins/pluginSettings';

import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { useIrmPlugin } from './usePluginBridge';

jest.mock('app/features/plugins/pluginSettings');

const mockedGetPluginSettings = jest.mocked(getPluginSettings);

describe('useIrmPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return IRM plugin ID when IRM plugin is installed', async () => {
    mockedGetPluginSettings.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return Promise.resolve(pluginMeta[SupportedPlugin.Irm]);
      }
      if (pluginId === SupportedPlugin.OnCall) {
        return Promise.resolve({ ...pluginMeta[SupportedPlugin.OnCall], enabled: false });
      }
      return Promise.reject(new Error('Plugin not found'));
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
    mockedGetPluginSettings.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.OnCall) {
        return Promise.resolve(pluginMeta[SupportedPlugin.OnCall]);
      }
      return Promise.reject(new Error('Plugin not found'));
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
    mockedGetPluginSettings.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Incident) {
        return Promise.resolve(pluginMeta[SupportedPlugin.Incident]);
      }
      return Promise.reject(new Error('Plugin not found'));
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
    mockedGetPluginSettings.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(pluginMeta[SupportedPlugin.Irm]), 100))
    );

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    expect(result.current.loading).toBe(true);
    expect(result.current.installed).toBeUndefined();
  });

  it('should return installed undefined when neither plugin is installed', async () => {
    mockedGetPluginSettings.mockRejectedValue(new Error('Plugin not found'));

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBeUndefined();
  });

  it('should return IRM plugin ID when both IRM and OnCall are installed', async () => {
    mockedGetPluginSettings.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return Promise.resolve(pluginMeta[SupportedPlugin.Irm]);
      }
      if (pluginId === SupportedPlugin.OnCall) {
        return Promise.resolve(pluginMeta[SupportedPlugin.OnCall]);
      }
      return Promise.reject(new Error('Plugin not found'));
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
    mockedGetPluginSettings.mockImplementation((pluginId) => {
      if (pluginId === SupportedPlugin.Irm) {
        return Promise.resolve(pluginMeta[SupportedPlugin.Irm]);
      }
      if (pluginId === SupportedPlugin.Incident) {
        return Promise.resolve(pluginMeta[SupportedPlugin.Incident]);
      }
      return Promise.reject(new Error('Plugin not found'));
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
