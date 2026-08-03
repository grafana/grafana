import { renderHook, waitFor } from 'test/test-utils';

import type { PluginMeta } from '@grafana/data';
import { isAppPluginInstalled } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { canAccessPluginPage } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { useGuides } from './useGuides';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAppPluginInstalled: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  canAccessPluginPage: jest.fn(),
}));

const mockIsAppPluginInstalled = jest.mocked(isAppPluginInstalled);
const mockGetPluginSettings = jest.mocked(getPluginSettings);
const mockCanAccessPluginPage = jest.mocked(canAccessPluginPage);

const pluginSettings = (id: string, enabled = true): PluginMeta<{}> => ({ id, enabled }) as PluginMeta<{}>;

function setInstalledPlugins(pluginIds: string[]) {
  const installed = new Set(pluginIds);
  mockIsAppPluginInstalled.mockImplementation(async (pluginId: string) => installed.has(pluginId));
}

function setPluginSettingsById(settingsById: Record<string, PluginMeta<{}>>) {
  mockGetPluginSettings.mockImplementation(async (pluginId: string) => {
    const settings = settingsById[pluginId];
    if (!settings) {
      throw new Error('Unknown plugin');
    }
    return settings;
  });
}

describe('useGuides', () => {
  const originalIsGrafanaAdmin = contextSrv.isGrafanaAdmin;
  let hasRoleSpy: jest.SpyInstance<boolean, [role: string]>;

  beforeEach(() => {
    contextSrv.isGrafanaAdmin = false;
    hasRoleSpy = jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);

    setInstalledPlugins([]);
    setPluginSettingsById({});
    mockCanAccessPluginPage.mockReturnValue(true);
  });

  afterEach(() => {
    contextSrv.isGrafanaAdmin = originalIsGrafanaAdmin;
    hasRoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('returns undefined while plugin gating is still loading', async () => {
    const { result } = renderHook(() => useGuides());

    expect(result.current).toBeUndefined();

    // Wait for the async probe to settle so React updates are consumed within the test lifecycle.
    await waitFor(() => expect(result.current).toBeDefined());
  });

  it('keeps non-plugin guides visible when no app plugins are installed', async () => {
    const { result } = renderHook(() => useGuides());

    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current?.map((guide) => guide.title)).toEqual(['Monitor infrastructure']);
  });

  it('filters plugin guides when canAccessPluginPage denies the route', async () => {
    setInstalledPlugins(['grafana-app-observability-app']);
    setPluginSettingsById({
      'grafana-app-observability-app': pluginSettings('grafana-app-observability-app', true),
    });
    mockCanAccessPluginPage.mockImplementation((_settings, pluginPagePath) => {
      return pluginPagePath !== '/a/grafana-app-observability-app/landing';
    });

    const { result } = renderHook(() => useGuides());

    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current?.map((guide) => guide.title)).toEqual(['Monitor infrastructure']);
    expect(mockCanAccessPluginPage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grafana-app-observability-app' }),
      '/a/grafana-app-observability-app/landing'
    );
  });

  it('hides setup guide routes for non-admin users even when plugin is enabled', async () => {
    setInstalledPlugins([SETUPGUIDE_PLUGIN_ID]);
    setPluginSettingsById({
      [SETUPGUIDE_PLUGIN_ID]: pluginSettings(SETUPGUIDE_PLUGIN_ID, true),
    });

    const { result } = renderHook(() => useGuides());

    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current?.map((guide) => guide.title)).toEqual(['Monitor infrastructure']);
    expect(mockCanAccessPluginPage).not.toHaveBeenCalled();
    expect(hasRoleSpy).toHaveBeenCalledWith('Admin');
  });

  it('shows setup guide routes for admins and still applies canAccessPluginPage per route', async () => {
    contextSrv.isGrafanaAdmin = true;
    setInstalledPlugins([SETUPGUIDE_PLUGIN_ID]);
    setPluginSettingsById({
      [SETUPGUIDE_PLUGIN_ID]: pluginSettings(SETUPGUIDE_PLUGIN_ID, true),
    });
    mockCanAccessPluginPage.mockImplementation((_settings, pluginPagePath) => {
      return pluginPagePath !== '/a/grafana-setupguide-app/getting-started/logs-onboarding';
    });

    const { result } = renderHook(() => useGuides());

    await waitFor(() => expect(result.current).toBeDefined());

    const titles = result.current?.map((guide) => guide.title) ?? [];
    expect(titles).toContain('Monitor infrastructure');
    expect(titles).toContain('Observe cloud services');
    expect(titles).toContain('Visualize existing data');
    expect(titles).toContain('Prometheus metrics');
    expect(titles).toContain('OpenTelemetry');
    expect(titles).toContain('Hosted telemetry data');
    expect(titles).not.toContain('Logs');
    expect(mockCanAccessPluginPage).toHaveBeenCalledWith(
      expect.objectContaining({ id: SETUPGUIDE_PLUGIN_ID }),
      '/a/grafana-setupguide-app/getting-started/logs-onboarding'
    );
  });

  it('gracefully degrades when one plugin settings lookup fails', async () => {
    setInstalledPlugins(['grafana-app-observability-app', 'grafana-synthetic-monitoring-app']);
    setPluginSettingsById({
      'grafana-app-observability-app': pluginSettings('grafana-app-observability-app', true),
    });

    const { result } = renderHook(() => useGuides());

    await waitFor(() => expect(result.current).toBeDefined());

    const titles = result.current?.map((guide) => guide.title) ?? [];
    expect(titles).toContain('Monitor infrastructure');
    expect(titles).toContain('Set up app monitoring');
    expect(titles).not.toContain('Monitor website uptime and performance');
  });
});
