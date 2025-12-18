import { renderHook, waitFor } from '@testing-library/react';

import { config } from '../../config';

import {
  getAppPluginMeta,
  getAppPluginMetas,
  getAppPluginVersion,
  isAppPluginInstalled,
  setAppPluginMetas,
} from './apps';
import { useAppPluginMeta, useAppPluginMetas, useAppPluginInstalled, useAppPluginVersion } from './hooks';
import { apps } from './test-fixtures/config.apps';

const actualApps = jest.requireActual<typeof import('./apps')>('./apps');
jest.mock('./apps', () => ({
  ...jest.requireActual('./apps'),
  getAppPluginMetas: jest.fn(),
  getAppPluginMeta: jest.fn(),
  isAppPluginInstalled: jest.fn(),
  getAppPluginVersion: jest.fn(),
}));
const getAppPluginMetaMock = jest.mocked(getAppPluginMeta);
const getAppPluginMetasMock = jest.mocked(getAppPluginMetas);
const isAppPluginInstalledMock = jest.mocked(isAppPluginInstalled);
const getAppPluginVersionMock = jest.mocked(getAppPluginVersion);

describe('useAppPluginMeta', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginMetaMock.mockImplementation(actualApps.getAppPluginMeta);
    config.featureToggles.useMTPlugins = false;
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    expect(result.current.appPluginMetaLoading).toEqual(true);
    expect(result.current.appPluginMetaError).toBeUndefined();
    expect(result.current.appPluginMeta).toBeUndefined();

    await waitFor(() => expect(result.current.appPluginMetaLoading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.appPluginMetaLoading).toEqual(false));

    expect(result.current.appPluginMetaLoading).toEqual(false);
    expect(result.current.appPluginMetaError).toBeUndefined();
    expect(result.current.appPluginMeta).toEqual(apps['grafana-exploretraces-app']);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginMetaLoading).toEqual(false));

    expect(result.current.appPluginMetaLoading).toEqual(false);
    expect(result.current.appPluginMetaError).toBeUndefined();
    expect(result.current.appPluginMeta).toEqual(null);
  });

  it('should return correct values if useAppPluginMeta throws', async () => {
    getAppPluginMetaMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginMetaLoading).toEqual(false));

    expect(result.current.appPluginMetaLoading).toEqual(false);
    expect(result.current.appPluginMetaError).toEqual(new Error('Some error'));
    expect(result.current.appPluginMeta).toBeUndefined();
  });
});

describe('useAppPluginMetas', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginMetasMock.mockImplementation(actualApps.getAppPluginMetas);
    config.featureToggles.useMTPlugins = false;
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    expect(result.current.appPluginMetasLoading).toEqual(true);
    expect(result.current.appPluginMetasError).toBeUndefined();
    expect(result.current.appPluginMetas).toBeUndefined();

    await waitFor(() => expect(result.current.appPluginMetasLoading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.appPluginMetasLoading).toEqual(false));

    expect(result.current.appPluginMetasLoading).toEqual(false);
    expect(result.current.appPluginMetasError).toBeUndefined();
    expect(result.current.appPluginMetas).toEqual(Object.values(apps));
  });

  it('should return correct values if useAppPluginMetas throws', async () => {
    getAppPluginMetasMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.appPluginMetasLoading).toEqual(false));

    expect(result.current.appPluginMetasLoading).toEqual(false);
    expect(result.current.appPluginMetasError).toEqual(new Error('Some error'));
    expect(result.current.appPluginMetas).toBeUndefined();
  });
});

describe('useAppPluginInstalled', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    isAppPluginInstalledMock.mockImplementation(actualApps.isAppPluginInstalled);
    config.featureToggles.useMTPlugins = false;
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    expect(result.current.appPluginInstalledLoading).toEqual(true);
    expect(result.current.appPluginInstalledError).toBeUndefined();
    expect(result.current.appPluginInstalled).toBeUndefined();

    await waitFor(() => expect(result.current.appPluginInstalledLoading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.appPluginInstalledLoading).toEqual(false));

    expect(result.current.appPluginInstalledLoading).toEqual(false);
    expect(result.current.appPluginInstalledError).toBeUndefined();
    expect(result.current.appPluginInstalled).toEqual(true);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginInstalledLoading).toEqual(false));

    expect(result.current.appPluginInstalledLoading).toEqual(false);
    expect(result.current.appPluginInstalledError).toBeUndefined();
    expect(result.current.appPluginInstalled).toEqual(false);
  });

  it('should return correct values if isAppPluginInstalled throws', async () => {
    isAppPluginInstalledMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginInstalledLoading).toEqual(false));

    expect(result.current.appPluginInstalledLoading).toEqual(false);
    expect(result.current.appPluginInstalledError).toEqual(new Error('Some error'));
    expect(result.current.appPluginInstalled).toBeUndefined();
  });
});

describe('useAppPluginVersion', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginVersionMock.mockImplementation(actualApps.getAppPluginVersion);
    config.featureToggles.useMTPlugins = false;
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    expect(result.current.appPluginVersionLoading).toEqual(true);
    expect(result.current.appPluginVersionError).toBeUndefined();
    expect(result.current.appPluginVersion).toBeUndefined();

    await waitFor(() => expect(result.current.appPluginVersionLoading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.appPluginVersionLoading).toEqual(false));

    expect(result.current.appPluginVersionLoading).toEqual(false);
    expect(result.current.appPluginVersionError).toBeUndefined();
    expect(result.current.appPluginVersion).toEqual('1.2.2');
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginVersionLoading).toEqual(false));

    expect(result.current.appPluginVersionLoading).toEqual(false);
    expect(result.current.appPluginVersionError).toBeUndefined();
    expect(result.current.appPluginVersion).toEqual(null);
  });

  it('should return correct values if getAppPluginVersion throws', async () => {
    getAppPluginVersionMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.appPluginVersionLoading).toEqual(false));

    expect(result.current.appPluginVersionLoading).toEqual(false);
    expect(result.current.appPluginVersionError).toEqual(new Error('Some error'));
    expect(result.current.appPluginVersion).toBeUndefined();
  });
});
