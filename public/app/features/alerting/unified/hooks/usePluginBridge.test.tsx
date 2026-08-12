import { renderHook, waitFor } from '@testing-library/react';

import { OrgRole, PluginIncludeType } from '@grafana/data';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';

import { setupMswServer } from '../mockApi';
import { addPlugin, disablePlugin, failPlugin, removePlugin } from '../mocks/server/configure';
import { pluginMeta } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import { canAccessPluginPage, useIrmPlugin } from './usePluginBridge';

const server = setupMswServer();

describe('useIrmPlugin', () => {
  let requestedPluginSettings: string[] = [];

  const recordPluginSettingsRequest = ({ request }: { request: Request }) => {
    const match = new URL(request.url).pathname.match(/^\/api\/plugins\/(.+)\/settings$/);
    if (match) {
      requestedPluginSettings.push(match[1]);
    }
  };

  beforeAll(() => {
    server.events.on('request:start', recordPluginSettingsRequest);
  });

  afterAll(() => {
    server.events.removeListener('request:start', recordPluginSettingsRequest);
  });

  beforeEach(() => {
    requestedPluginSettings = [];
  });

  afterEach(() => {
    invalidateCachedPromisesCache();
  });

  it('should return IRM plugin ID when IRM plugin is installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.Irm]);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return OnCall plugin ID when IRM plugin is not installed', async () => {
    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return Incident plugin ID when IRM plugin is not installed', async () => {
    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.Incident));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Incident);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toBeDefined();
  });

  it('should return loading state while fetching plugins', async () => {
    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    expect(result.current.loading).toBe(true);
    expect(result.current.installed).toBeUndefined();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should never report "not installed" before the check has settled', async () => {
    const states: Array<{ loading: boolean; installed?: boolean }> = [];

    const { result } = renderHook(() => {
      const bridge = useIrmPlugin(SupportedPlugin.OnCall);
      states.push({ loading: bridge.loading, installed: bridge.installed });
      return bridge;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // a settled state must be the final answer – no flash of installed: false in between
    const firstSettled = states.findIndex((state) => !state.loading);
    expect(states.slice(firstSettled).every((state) => state.installed === true)).toBe(true);
  });

  it('should not request settings for a plugin that is not installed', async () => {
    removePlugin(SupportedPlugin.OnCall);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(requestedPluginSettings).not.toContain(SupportedPlugin.OnCall);
  });

  it('should not request the fallback plugin settings when IRM is installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.Irm]);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(requestedPluginSettings).toContain(SupportedPlugin.Irm);
    expect(requestedPluginSettings).not.toContain(SupportedPlugin.OnCall);
  });

  it('should return installed false when neither plugin is installed (404)', async () => {
    removePlugin(SupportedPlugin.OnCall);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should return installed false when plugin is disabled', async () => {
    disablePlugin(SupportedPlugin.OnCall);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should propagate error when plugin check fails with a non-404 error', async () => {
    failPlugin(SupportedPlugin.OnCall, 500);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.OnCall);
    expect(result.current.installed).toBeUndefined();
    expect(result.current.error).toBeDefined();
  });

  it('should return IRM plugin ID when both IRM and OnCall are installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.Irm]);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.OnCall));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toEqual(expect.objectContaining({ id: SupportedPlugin.Irm }));
  });

  it('should return IRM plugin ID when both IRM and Incident are installed', async () => {
    addPlugin(pluginMeta[SupportedPlugin.Irm]);

    const { result } = renderHook(() => useIrmPlugin(SupportedPlugin.Incident));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
    expect(result.current.installed).toBe(true);
    expect(result.current.settings).toEqual(expect.objectContaining({ id: SupportedPlugin.Irm }));
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
