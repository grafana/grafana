import { act, renderHook, waitFor } from '@testing-library/react';

import { config, isAppPluginInstalled } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';

import { logError } from '../Analytics';
import { prometheusAlertingPluginMeta } from '../testSetup/plugins';

import { DMAStatus, useDMAStatus } from './useDMAStatus';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAppPluginInstalled: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
}));

jest.mock('../Analytics', () => ({
  ...jest.requireActual('../Analytics'),
  logError: jest.fn(),
}));

const isAppPluginInstalledMock = jest.mocked(isAppPluginInstalled);
const getPluginSettingsMock = jest.mocked(getPluginSettings);
const logErrorMock = jest.mocked(logError);

function mockInstalledPlugin(enabled: boolean) {
  isAppPluginInstalledMock.mockResolvedValue(true);
  getPluginSettingsMock.mockResolvedValue({ ...prometheusAlertingPluginMeta, enabled });
}

describe('useDMAStatus', () => {
  const originalFeatureToggle = config.featureToggles.alertingDisableDMAinUI;

  beforeEach(() => {
    config.featureToggles.alertingDisableDMAinUI = false;
    isAppPluginInstalledMock.mockResolvedValue(false);
  });

  afterEach(() => {
    config.featureToggles.alertingDisableDMAinUI = originalFeatureToggle;
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('disables DMA while plugin discovery is loading', () => {
    isAppPluginInstalledMock.mockReturnValue(new Promise<boolean>(() => {}));

    const { result } = renderHook(() => useDMAStatus());

    expect(result.current.status).toBe(DMAStatus.Loading);
  });

  it('falls back to Grafana-managed rules and logs when plugin discovery times out', async () => {
    jest.useFakeTimers();
    isAppPluginInstalledMock.mockReturnValue(new Promise<boolean>(() => {}));

    const { result } = renderHook(() => useDMAStatus());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.status).toBe(DMAStatus.ManagedByGrafana);
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Timed out while checking Prometheus Alerting plugin status' }),
      { timeout: '5000' }
    );
  });

  it('enables DMA without requesting settings when the plugin is not installed', async () => {
    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.ManagedByGrafana));

    expect(getPluginSettingsMock).not.toHaveBeenCalled();
  });

  it.each([
    [false, DMAStatus.ManagedByGrafana],
    [true, DMAStatus.ManagedByPlugin],
  ])('maps an installed plugin with enabled=%s to %s', async (enabled, expectedStatus) => {
    mockInstalledPlugin(enabled);

    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(expectedStatus));
  });

  it('uses an enabled plugin when the feature toggle is enabled', async () => {
    config.featureToggles.alertingDisableDMAinUI = true;
    mockInstalledPlugin(true);

    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.ManagedByPlugin));
  });

  it('disables DMA when the feature toggle is enabled', async () => {
    config.featureToggles.alertingDisableDMAinUI = true;

    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.NotAvailable));
  });

  it('enables DMA when plugin discovery fails', async () => {
    isAppPluginInstalledMock.mockRejectedValue(new Error('plugin discovery failed'));

    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.ManagedByGrafana));

    expect(result.current.error).toEqual(new Error('plugin discovery failed'));
  });
});
