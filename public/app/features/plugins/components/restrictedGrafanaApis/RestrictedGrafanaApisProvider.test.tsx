import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useRestrictedGrafanaApis } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { RestrictedGrafanaApisProvider } from './RestrictedGrafanaApisProvider';

// Read once at module load by the provider.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  actual.config.featureToggles.restrictedPluginApis = true;
  return actual;
});

const COMPOSER_FLAG = 'grafana.dashboardComposer';

describe('RestrictedGrafanaApisProvider dashboardComposer', () => {
  beforeEach(() => {
    jest.replaceProperty(config.bootData, 'settings', {
      ...config.bootData.settings,
      pluginRestrictedAPIsAllowList: {
        dashboardMutationAPI: ['grafana-assistant-app'],
        dashboardComposer: ['grafana-assistant-app'],
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
    expect(result.current.dashboardComposer?.version).toBe(1);
    expect(result.current.dashboardComposer?.canEnter()).toEqual({ ok: false, reason: 'not_dashboard' });
    expect(result.current.dashboardMutationAPI).toBeDefined();
  });

  it('withholds Composer from other plugins', () => {
    setTestFlags({ [COMPOSER_FLAG]: true });
    const { result } = renderRestrictedApis('another-app');
    expect(result.current.dashboardComposer).toBeUndefined();
  });

  it('removes and restores Composer with the flag without replacing the mutation API', async () => {
    setTestFlags({ [COMPOSER_FLAG]: false });
    const { result } = renderRestrictedApis('grafana-assistant-app');
    expect(result.current.dashboardComposer).toBeUndefined();
    const mutationApi = result.current.dashboardMutationAPI;

    act(() => setTestFlags({ [COMPOSER_FLAG]: true }));
    await waitFor(() => expect(result.current.dashboardComposer).toBeDefined());
    expect(result.current.dashboardMutationAPI).toBe(mutationApi);

    act(() => setTestFlags({ [COMPOSER_FLAG]: false }));
    await waitFor(() => expect(result.current.dashboardComposer).toBeUndefined());
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
