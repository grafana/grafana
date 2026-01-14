import { renderHook, waitFor } from '@testing-library/react';

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
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMeta('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(apps['grafana-exploretraces-app']);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if useAppPluginMeta throws', async () => {
    getAppPluginMetaMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMeta('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginMetas', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginMetasMock.mockImplementation(actualApps.getAppPluginMetas);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(Object.values(apps));
  });

  it('should return correct values if useAppPluginMetas throws', async () => {
    getAppPluginMetasMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginMetas());

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginInstalled', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    isAppPluginInstalledMock.mockImplementation(actualApps.isAppPluginInstalled);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(true);
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(false);
  });

  it('should return correct values if isAppPluginInstalled throws', async () => {
    isAppPluginInstalledMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginInstalled('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});

describe('useAppPluginVersion', () => {
  beforeEach(() => {
    setAppPluginMetas(apps);
    jest.resetAllMocks();
    getAppPluginVersionMock.mockImplementation(actualApps.getAppPluginVersion);
  });

  it('should return correct default values', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    expect(result.current.loading).toEqual(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toEqual(true));
  });

  it('should return correct values after loading', async () => {
    const { result } = renderHook(() => useAppPluginVersion('grafana-exploretraces-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual('1.2.2');
  });

  it('should return correct values if the pluginId does not exist', async () => {
    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.value).toEqual(null);
  });

  it('should return correct values if getAppPluginVersion throws', async () => {
    getAppPluginVersionMock.mockRejectedValue(new Error('Some error'));

    const { result } = renderHook(() => useAppPluginVersion('otherorg-otherplugin-app'));

    await waitFor(() => expect(result.current.loading).toEqual(false));

    expect(result.current.loading).toEqual(false);
    expect(result.current.error).toEqual(new Error('Some error'));
    expect(result.current.value).toBeUndefined();
  });
});
