import { act } from '@testing-library/react';

import { type PluginMeta } from '@grafana/data';
import { setLogger } from '@grafana/runtime/unstable';

import { probePlugin } from '../hooks/pluginBridgeProbe';

import { isPrometheusAlertingPluginEnabled } from './pluginAvailability';

jest.mock('../hooks/pluginBridgeProbe', () => ({
  ...jest.requireActual('../hooks/pluginBridgeProbe'),
  probePlugin: jest.fn(),
}));

const logError = jest.fn();

beforeEach(() => {
  jest.mocked(probePlugin).mockReset();
  logError.mockClear();
  setLogger('features.alerting', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('isPrometheusAlertingPluginEnabled', () => {
  it('returns true when the plugin is installed and enabled', async () => {
    jest.mocked(probePlugin).mockResolvedValue({ settings: { enabled: true } as PluginMeta<{}> });

    await expect(isPrometheusAlertingPluginEnabled()).resolves.toBe(true);
  });

  it('returns false when the plugin is unavailable', async () => {
    jest.mocked(probePlugin).mockResolvedValue({});

    await expect(isPrometheusAlertingPluginEnabled()).resolves.toBe(false);
  });

  it('returns false when the plugin settings check fails', async () => {
    jest.mocked(probePlugin).mockRejectedValue(new Error('plugin settings request failed'));

    await expect(isPrometheusAlertingPluginEnabled()).resolves.toBe(false);
  });

  it('returns false and logs when discovery times out', async () => {
    jest.mocked(probePlugin).mockReturnValue(new Promise(() => {}));
    jest.useFakeTimers();

    const available = isPrometheusAlertingPluginEnabled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    await expect(available).resolves.toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while checking Prometheus Alerting plugin status' }),
      { timeout: '5000' }
    );
  });
});
