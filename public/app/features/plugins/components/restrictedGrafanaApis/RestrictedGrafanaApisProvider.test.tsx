import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useRestrictedGrafanaApis } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { RestrictedGrafanaApisProvider } from './RestrictedGrafanaApisProvider';
import { alertingAlertRuleFormSchemaApi } from './alerting/alertRuleFormSchema';
import { getRestrictedGrafanaApisAtLoad } from './restrictedGrafanaApis';

// Read once at module load by the provider.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  actual.config.featureToggles.restrictedPluginApis = true;
  return actual;
});

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
  const PLUGIN = 'myorg-test-app';
  const settings = config.bootData.settings;

  function lists(allow: Record<string, string[]> | undefined, block: Record<string, string[]> | undefined = undefined) {
    jest.replaceProperty(config.bootData, 'settings', {
      ...settings,
      pluginRestrictedAPIsAllowList: allow,
      pluginRestrictedAPIsBlockList: block,
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gives an allowlisted plugin the same objects its roots get from the provider', () => {
    lists({ alertingAlertRuleFormSchema: [PLUGIN], dashboardMutationAPI: [PLUGIN] });

    const atLoad = getRestrictedGrafanaApisAtLoad(PLUGIN);
    const { result } = renderRestrictedApis(PLUGIN);

    expect(atLoad.alertingAlertRuleFormSchema).toBe(alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema);
    expect(atLoad.alertingAlertRuleFormSchema).toBe(result.current.alertingAlertRuleFormSchema);
    // Created per provider and bound to the plugin's mounted roots.
    expect(result.current.dashboardMutationAPI).toBeDefined();
    expect(atLoad.dashboardMutationAPI).toBeUndefined();
  });

  it('gives a plugin that is not allowlisted none of them', () => {
    lists({ alertingAlertRuleFormSchema: [PLUGIN] });

    expect(getRestrictedGrafanaApisAtLoad('another-app')).toEqual({});
  });

  it('respects the block list when there is no allow list', () => {
    lists(undefined, { alertingAlertRuleFormSchema: [PLUGIN] });

    expect(getRestrictedGrafanaApisAtLoad(PLUGIN).alertingAlertRuleFormSchema).toBeUndefined();
    expect(getRestrictedGrafanaApisAtLoad('another-app').alertingAlertRuleFormSchema).toBeDefined();
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
