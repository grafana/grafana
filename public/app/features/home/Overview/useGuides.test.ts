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

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useTheme2: () => ({
    visualization: {
      getColorByName: (name: string) => name,
    },
  }),
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

  it('filters plugin guides when canAccessPluginPage denies the route', async () => {
    setInstalledPlugins(['grafana-app-observability-app', 'grafana-synthetic-monitoring-app']);
    setPluginSettingsById({
      'grafana-app-observability-app': pluginSettings('grafana-app-observability-app', true),
      'grafana-synthetic-monitoring-app': pluginSettings('grafana-synthetic-monitoring-app', true),
    });
    mockCanAccessPluginPage.mockImplementation((_settings, pluginPagePath) => {
      return pluginPagePath === '/a/grafana-app-observability-app/landing';
    });

    const result = renderHook(() => useGuides()).result;
    await waitFor(() => expect(result.current).toBeDefined());

    const ids = result.current?.map((guide) => guide.id) ?? [];
    expect(ids).toContain('app-monitoring');
    expect(ids).not.toContain('website-monitoring');

    expect(mockCanAccessPluginPage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grafana-app-observability-app' }),
      '/a/grafana-app-observability-app/landing'
    );
    expect(mockCanAccessPluginPage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'grafana-synthetic-monitoring-app' }),
      '/a/grafana-synthetic-monitoring-app/checks/new/api-endpoint'
    );
  });

  it('hides setup guide routes for non-admin users even when plugin is enabled', async () => {
    setInstalledPlugins([SETUPGUIDE_PLUGIN_ID]);
    setPluginSettingsById({
      [SETUPGUIDE_PLUGIN_ID]: pluginSettings(SETUPGUIDE_PLUGIN_ID, true),
    });

    const { result } = renderHook(() => useGuides());
    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current?.map((guide) => guide.id)).toEqual([]);
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

    const ids = result.current?.map((guide) => guide.id) ?? [];
    expect(ids).toContain('infra-monitoring');
    expect(ids).toContain('cloud-monitoring');
    expect(ids).toContain('visualize-data');
    expect(ids).toContain('prometheus-metrics');
    expect(ids).toContain('opentelemetry');
    expect(ids).toContain('hosted-data');
    expect(ids).not.toContain('logs');
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

    const ids = result.current?.map((guide) => guide.id) ?? [];
    expect(ids).toContain('app-monitoring');
    expect(ids).not.toContain('website-monitoring');
  });
});
