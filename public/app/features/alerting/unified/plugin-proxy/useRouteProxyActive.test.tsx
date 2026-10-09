import { HttpResponse, delay, http } from 'msw';
import { act, renderHook, waitFor } from 'test/test-utils';

import { type MonitoringLogger } from '@grafana/runtime';
import { invalidatePluginSettingsCache } from '@grafana/runtime/internal';
import server from '@grafana/test-utils/server';
import { mockLogger } from '@grafana/test-utils/unstable';

import { setupMswServer } from '../mockApi';
import { failPlugin } from '../mocks/server/configure';
import { setupPrometheusAlertingPlugin } from '../testSetup/prometheusAlertingPlugin';
import { SupportedPlugin } from '../types/pluginBridges';

import { isPrometheusAlertingPluginEnabled } from './pluginAvailability';
import { useRouteProxyActive } from './withRouteProxy';

const mockAvailabilityChunk = { failsToLoad: false };

// The real check runs, so the settings request goes through MSW. Wrapping it in `jest.fn` records
// the promise each call returns, which is how the tests tell that the check has finished. The getter
// lets one test make reading the lazily loaded module throw, as it does when its chunk can't be fetched.
jest.mock('./pluginAvailability', () => {
  const actual = jest.requireActual('./pluginAvailability');
  const recordedCheck = jest.fn(actual.isPrometheusAlertingPluginEnabled);
  return {
    get isPrometheusAlertingPluginEnabled() {
      if (mockAvailabilityChunk.failsToLoad) {
        throw new Error('Loading chunk PrometheusAlertingPluginAvailability failed.');
      }
      return recordedCheck;
    },
  };
});

setupMswServer();
const PLUGIN_SETTINGS_URL = `/api/plugins/${SupportedPlugin.PrometheusAlerting}/settings`;
const pluginCheck = jest.mocked(isPrometheusAlertingPluginEnabled);

async function waitForPluginCheckToStart() {
  await waitFor(() => expect(pluginCheck).toHaveBeenCalled());
}

/**
 * The hook reads false both while the check is running and after it fails, so a test that expects
 * false has to wait for the check itself, or it would pass without the check ever finishing.
 */
async function waitForPluginCheckToFinish() {
  await waitForPluginCheckToStart();
  const runningCheck = pluginCheck.mock.results[0].value;
  // Its result lands in the hook's state, and React only applies that inside `act`.
  await act(() => runningCheck);
}

async function renderRouteProxyActive() {
  const view = renderHook(() => useRouteProxyActive());
  await waitForPluginCheckToFinish();
  return view;
}

describe('useRouteProxyActive', () => {
  setupPrometheusAlertingPlugin();

  let logger: MonitoringLogger;

  beforeEach(() => {
    logger = mockLogger('features.alerting');
    pluginCheck.mockClear();
  });

  afterEach(() => {
    mockAvailabilityChunk.failsToLoad = false;
    jest.useRealTimers();
  });

  it('is true once the check finds the plugin installed and enabled', async () => {
    const { result } = await renderRouteProxyActive();

    // Proves the helper waits long enough for the answer to reach the hook, which the failure
    // cases below rely on, since false is also what the hook reads before the check comes back.
    expect(result.current).toBe(true);
  });

  it('is false when the plugin settings request fails', async () => {
    failPlugin(SupportedPlugin.PrometheusAlerting, 500);

    const { result } = await renderRouteProxyActive();

    expect(result.current).toBe(false);
  });

  it('is false when the plugin settings request never responds', async () => {
    invalidatePluginSettingsCache(SupportedPlugin.PrometheusAlerting);
    server.use(
      http.get(PLUGIN_SETTINGS_URL, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      })
    );
    jest.useFakeTimers();

    const { result } = renderHook(() => useRouteProxyActive());
    await waitForPluginCheckToStart();
    // Past the check's 5s discovery timeout.
    await act(() => jest.advanceTimersByTimeAsync(5_000));
    await waitForPluginCheckToFinish();

    expect(result.current).toBe(false);
  });

  it('is false when the availability check chunk fails to load', async () => {
    mockAvailabilityChunk.failsToLoad = true;

    const { result } = renderHook(() => useRouteProxyActive());

    await waitFor(() =>
      expect(logger.logWarning).toHaveBeenCalledWith('Could not check Prometheus Alerting plugin availability', {
        error: 'Error: Loading chunk PrometheusAlertingPluginAvailability failed.',
      })
    );
    // The warning is logged before the check returns, so let its answer reach the hook first.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(result.current).toBe(false);
  });
});
