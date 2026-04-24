import { renderHook, waitFor } from '@testing-library/react';

import { OrgRole, PluginIncludeType } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { useGetPluginSettingsQuery } from '../api/pluginsApi';
import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { canAccessPluginPage, useIrmPlugin } from './usePluginBridge';

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
        error: { status: 404, data: { message: 'Plugin not found' } },
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
        error: { status: 404, data: { message: 'Plugin not found' } },
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
        error: { status: 404, data: { message: 'Plugin not found' } },
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

  it('should return installed false when neither plugin is installed (404)', async () => {
    mockedUseGetPluginSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 404, data: { message: 'Plugin not found' } },
      refetch: jest.fn(),
    } as PluginQueryResult);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should propagate error when plugin check fails with a non-404 error', async () => {
    mockedUseGetPluginSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, data: { message: 'Internal server error' } },
      refetch: jest.fn(),
    } as PluginQueryResult);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBeUndefined();
    expect(result.current.error).toBeDefined();
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
        error: { status: 404, data: { message: 'Plugin not found' } },
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
        error: { status: 404, data: { message: 'Plugin not found' } },
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

describe('canAccessPluginPage', () => {
  const previousRole = contextSrv.user.orgRole;
  const previousPermissions = contextSrv.user.permissions;
  const previousIsEditor = contextSrv.isEditor;
  const previousIsGrafanaAdmin = contextSrv.isGrafanaAdmin;

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
    contextSrv.user.permissions = previousPermissions;
    contextSrv.isEditor = previousIsEditor;
    contextSrv.isGrafanaAdmin = previousIsGrafanaAdmin;
  });

  it('returns false when include requires action and user lacks permission', () => {
    contextSrv.user.permissions = {};
    const settings = {
      ...pluginMeta[SupportedPlugin.Incident],
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Declare incident',
          path: '/a/grafana-incident-app/incidents/declare',
          action: 'grafana-incident-app.incidents:write',
        },
      ],
    };

    expect(canAccessPluginPage(settings, '/a/grafana-incident-app/incidents/declare')).toBe(false);
  });

  it('returns true when include requires action and user has permission', () => {
    contextSrv.user.permissions = { 'grafana-incident-app.incidents:write': true };
    const settings = {
      ...pluginMeta[SupportedPlugin.Incident],
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Declare incident',
          path: '/a/grafana-incident-app/incidents/declare',
          action: 'grafana-incident-app.incidents:write',
        },
      ],
    };

    expect(canAccessPluginPage(settings, '/a/grafana-incident-app/incidents/declare')).toBe(true);
  });

  it('returns false when include role is editor and user is viewer', () => {
    contextSrv.user.orgRole = OrgRole.Viewer;
    contextSrv.isEditor = false;
    const settings = {
      ...pluginMeta[SupportedPlugin.Incident],
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Declare incident',
          path: '/a/grafana-incident-app/incidents/declare',
          role: OrgRole.Editor,
        },
      ],
    };

    expect(canAccessPluginPage(settings, '/a/grafana-incident-app/incidents/declare')).toBe(false);
  });
});
