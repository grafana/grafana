import { renderHook, waitFor } from '@testing-library/react';

import { config, isAppPluginInstalled } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';

import { DMAStatus, useDMAStatus } from './useDMAStatus';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAppPluginInstalled: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
}));

const isAppPluginInstalledMock = jest.mocked(isAppPluginInstalled);
const getPluginSettingsMock = jest.mocked(getPluginSettings);

describe('useDMAStatus', () => {
  const originalFeatureToggle = config.featureToggles.alertingDisableDMAinUI;

  beforeEach(() => {
    config.featureToggles.alertingDisableDMAinUI = false;
    isAppPluginInstalledMock.mockResolvedValue(false);
  });

  afterEach(() => {
    config.featureToggles.alertingDisableDMAinUI = originalFeatureToggle;
    jest.resetAllMocks();
  });

  it('disables DMA while plugin discovery is loading', () => {
    isAppPluginInstalledMock.mockReturnValue(new Promise<boolean>(() => {}));

    const { result } = renderHook(() => useDMAStatus());

    expect(result.current.status).toBe(DMAStatus.Loading);
  });

  it('enables DMA without requesting settings when the plugin is not installed', async () => {
    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.ManagedByGrafana));

    expect(getPluginSettingsMock).not.toHaveBeenCalled();
  });

  it('enables DMA when the plugin is installed but disabled', async () => {
    isAppPluginInstalledMock.mockResolvedValue(true);
    getPluginSettingsMock.mockResolvedValue({ enabled: false } as Awaited<ReturnType<typeof getPluginSettings>>);

    const { result } = renderHook(() => useDMAStatus());

    await waitFor(() => expect(result.current.status).toBe(DMAStatus.ManagedByGrafana));
  });

  it('disables DMA when the plugin is installed and enabled', async () => {
    isAppPluginInstalledMock.mockResolvedValue(true);
    getPluginSettingsMock.mockResolvedValue({ enabled: true } as Awaited<ReturnType<typeof getPluginSettings>>);

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
