import { renderHook } from '@testing-library/react';

import { useRestrictedGrafanaApis } from '@grafana/data';
import { config } from '@grafana/runtime';

import { RestrictedGrafanaApisProvider } from './RestrictedGrafanaApisProvider';
import { alertingAlertRuleFormSchemaApi } from './alerting/alertRuleFormSchema';
import { getRestrictedGrafanaApisAtLoad } from './restrictedGrafanaApis';

// Read once at module load.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  actual.config.featureToggles.restrictedPluginApis = true;
  return actual;
});

const PLUGIN = 'myorg-test-app';

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
    jest.restoreAllMocks();
  });

  it('gives an allowlisted plugin the same objects its roots get from the provider', () => {
    lists({ alertingAlertRuleFormSchema: [PLUGIN], dashboardMutationAPI: [PLUGIN] });

    const atLoad = getRestrictedGrafanaApisAtLoad(PLUGIN);
    const { result } = renderHook(() => useRestrictedGrafanaApis(), {
      wrapper: ({ children }) => (
        <RestrictedGrafanaApisProvider pluginId={PLUGIN}>{children}</RestrictedGrafanaApisProvider>
      ),
    });

    expect(atLoad.alertingAlertRuleFormSchema).toBe(alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema);
    expect(atLoad.alertingAlertRuleFormSchema).toBe(result.current.alertingAlertRuleFormSchema);
    // It acts on what the plugin's mounted roots show, so it stays with the provider.
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
