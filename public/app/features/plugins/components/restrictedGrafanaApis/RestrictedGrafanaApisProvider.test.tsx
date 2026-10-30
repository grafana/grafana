import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useRestrictedGrafanaApis } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { RestrictedGrafanaApisProvider } from './RestrictedGrafanaApisProvider';
import { composerApi } from './composer/composerApi';
import { extensionSidebarApi } from './extensionSidebar/extensionSidebarApi';
import { getRestrictedGrafanaApisAtLoad } from './restrictedGrafanaApis';

const COMPOSER_FLAG = 'grafana.dashboardComposer';

describe('RestrictedGrafanaApisProvider composer', () => {
  beforeEach(() => {
    jest.replaceProperty(config.bootData, 'settings', {
      ...config.bootData.settings,
      pluginRestrictedAPIsAllowList: {
        dashboardMutationAPI: ['grafana-assistant-app'],
        composer: ['grafana-assistant-app'],
      },
    });
  });

  afterEach(() => {
    act(() => setTestFlags({}));
    jest.restoreAllMocks();
  });

  it('exposes Composer to Assistant while the flag is on', () => {
    setTestFlags({ [COMPOSER_FLAG]: true });
    const { result } = renderRestrictedApis('grafana-assistant-app');
    expect(result.current.composer?.version).toBe(1);
    expect(result.current.composer?.canEnter()).toEqual({ ok: false, reason: 'no_document' });
    expect(result.current.dashboardMutationAPI).toBeDefined();
    // Only the `composer` key: the earlier `dashboardComposer` name is gone.
    expect(result.current).not.toHaveProperty('dashboardComposer');
  });

  it('exposes Composer with only the notebook flag on, while dashboards stay unsupported', () => {
    setTestFlags({ 'grafana.notebookComposer': true, 'dashboard.notebooks': true });
    const { result } = renderRestrictedApis('grafana-assistant-app');
    expect(result.current.composer?.version).toBe(1);
    expect(result.current.composer?.canEnter({ resource: 'notebook', uid: 'nowhere' })).toEqual({
      ok: false,
      reason: 'no_document',
    });
  });

  it('withholds Composer from other plugins', () => {
    setTestFlags({ [COMPOSER_FLAG]: true });
    const { result } = renderRestrictedApis('another-app');
    expect(result.current.composer).toBeUndefined();
  });

  it('removes and restores Composer with the flag without replacing the mutation API', async () => {
    setTestFlags({ [COMPOSER_FLAG]: false });
    const { result } = renderRestrictedApis('grafana-assistant-app');
    expect(result.current.composer).toBeUndefined();
    const mutationApi = result.current.dashboardMutationAPI;

    act(() => setTestFlags({ [COMPOSER_FLAG]: true }));
    await waitFor(() => expect(result.current.composer).toBeDefined());
    expect(result.current.dashboardMutationAPI).toBe(mutationApi);

    act(() => setTestFlags({ [COMPOSER_FLAG]: false }));
    await waitFor(() => expect(result.current.composer).toBeUndefined());
  });
});

// What an app plugin's module gets through AppPlugin.onRestrictedApis, before any of its roots mounts.
describe('restricted APIs at plugin load', () => {
  const settings = config.bootData.settings;

  function lists(allow: Record<string, string[]> | undefined, block: Record<string, string[]> | undefined = undefined) {
    jest.replaceProperty(config.bootData, 'settings', {
      ...settings,
      pluginRestrictedAPIsAllowList: allow,
      pluginRestrictedAPIsBlockList: block,
    });
  }

  afterEach(() => {
    act(() => setTestFlags({}));
    jest.restoreAllMocks();
  });

  it('gives an allowlisted plugin the same objects its roots get from the provider', () => {
    lists({ composer: ['grafana-assistant-app'], extensionSidebar: ['grafana-assistant-app'] });
    setTestFlags({ [COMPOSER_FLAG]: true });

    const atLoad = getRestrictedGrafanaApisAtLoad('grafana-assistant-app');
    const { result } = renderRestrictedApis('grafana-assistant-app');

    expect(atLoad.composer).toBe(composerApi);
    expect(atLoad.extensionSidebar).toBe(extensionSidebarApi);
    expect(atLoad.composer).toBe(result.current.composer);
    expect(atLoad.extensionSidebar).toBe(result.current.extensionSidebar);
    // Created per provider and bound to the plugin's mounted roots.
    expect(atLoad.dashboardMutationAPI).toBeUndefined();
  });

  it('gives a plugin that is not allowlisted none of them', () => {
    lists({ composer: ['grafana-assistant-app'], extensionSidebar: ['grafana-assistant-app'] });
    setTestFlags({ [COMPOSER_FLAG]: true });

    expect(getRestrictedGrafanaApisAtLoad('another-app')).toEqual({});
  });

  it('respects the block list when there is no allow list', () => {
    lists(undefined, { composer: ['grafana-assistant-app'], extensionSidebar: ['another-app'] });
    setTestFlags({ [COMPOSER_FLAG]: true });

    const atLoad = getRestrictedGrafanaApisAtLoad('grafana-assistant-app');

    expect(atLoad.composer).toBeUndefined();
    expect(atLoad.extensionSidebar).toBe(extensionSidebarApi);
    expect(getRestrictedGrafanaApisAtLoad('another-app').extensionSidebar).toBeUndefined();
  });

  it('leaves Composer out while its flags are off at load', () => {
    lists({ composer: ['grafana-assistant-app'] });

    expect(getRestrictedGrafanaApisAtLoad('grafana-assistant-app').composer).toBeUndefined();
  });
});

describe('RestrictedGrafanaApisProvider without an OpenFeatureProvider above it', () => {
  beforeEach(() => {
    jest.replaceProperty(config.bootData, 'settings', {
      ...config.bootData.settings,
      pluginRestrictedAPIsAllowList: { composer: ['grafana-assistant-app'] },
    });
  });

  afterEach(() => {
    act(() => setTestFlags({}));
    jest.restoreAllMocks();
  });

  // Extension components get this provider wherever they render.
  it("renders, and still follows Composer's flag", async () => {
    setTestFlags({ [COMPOSER_FLAG]: true });
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }) => (
        <RestrictedGrafanaApisProvider pluginId="grafana-assistant-app">{children}</RestrictedGrafanaApisProvider>
      ),
    });
    expect(result.current.composer).toBeDefined();

    act(() => setTestFlags({ [COMPOSER_FLAG]: false }));
    await waitFor(() => expect(result.current.composer).toBeUndefined());

    act(() => setTestFlags({ [COMPOSER_FLAG]: true }));
    await waitFor(() => expect(result.current.composer).toBeDefined());
  });
});

function renderRestrictedApis(pluginId: string) {
  return renderHook(() => useRestrictedGrafanaApis(), {
    wrapper: ({ children }) => (
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <RestrictedGrafanaApisProvider pluginId={pluginId}>{children}</RestrictedGrafanaApisProvider>
      </OpenFeatureProvider>
    ),
  });
}
