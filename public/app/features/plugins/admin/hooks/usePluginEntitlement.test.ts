import { act, renderHook, waitFor } from '@testing-library/react';

import { PluginSignatureStatus } from '@grafana/data/types';

import { getPluginEntitlement } from '../api';
import { type CatalogPlugin } from '../types';

import { clearEntitlementCache, usePluginEntitlement } from './usePluginEntitlement';

jest.mock('../api', () => ({
  getPluginEntitlement: jest.fn(),
}));

const mockGetPluginEntitlement = jest.mocked(getPluginEntitlement);

const basePlugin: CatalogPlugin = {
  description: 'A test plugin',
  downloads: 0,
  id: 'test-plugin',
  info: {
    logos: { small: '', large: '' },
    keywords: [],
  },
  name: 'Test Plugin',
  orgName: 'Test Org',
  popularity: 0,
  signature: PluginSignatureStatus.valid,
  publishedAt: '2020-01-01',
  updatedAt: '2021-01-01',
  hasUpdate: false,
  isInstalled: false,
  isCore: false,
  isDev: false,
  isEnterprise: false,
  isDisabled: false,
  isDeprecated: false,
  isPublished: true,
  isPreinstalled: { found: false, withVersion: false },
  managed: { enabled: false, strategy: undefined },
};

const marketplacePlugin: CatalogPlugin = {
  ...basePlugin,
  distributionType: 'marketplace',
};

beforeEach(() => {
  jest.clearAllMocks();
  clearEntitlementCache();
});

describe('usePluginEntitlement', () => {
  it('returns not entitled and not loading immediately for a non-marketplace plugin', () => {
    const { result } = renderHook(() => usePluginEntitlement(basePlugin));
    expect(result.current).toEqual({ entitled: false, isLoading: false });
    expect(mockGetPluginEntitlement).not.toHaveBeenCalled();
  });

  it('returns not entitled and not loading for undefined plugin', () => {
    const { result } = renderHook(() => usePluginEntitlement(undefined));
    expect(result.current).toEqual({ entitled: false, isLoading: false });
    expect(mockGetPluginEntitlement).not.toHaveBeenCalled();
  });

  it('returns entitled=true and isLoading=false when API indicates entitlement', async () => {
    mockGetPluginEntitlement.mockResolvedValue(true);

    const { result } = renderHook(() => usePluginEntitlement(marketplacePlugin));

    await waitFor(() => {
      expect(result.current).toEqual({ entitled: true, isLoading: false });
    });

    expect(mockGetPluginEntitlement).toHaveBeenCalledWith('test-plugin');
  });

  it('returns entitled=false and isLoading=false when API indicates no entitlement', async () => {
    mockGetPluginEntitlement.mockResolvedValue(false);

    const { result } = renderHook(() => usePluginEntitlement(marketplacePlugin));

    await waitFor(() => {
      expect(result.current).toEqual({ entitled: false, isLoading: false });
    });

    expect(mockGetPluginEntitlement).toHaveBeenCalledWith('test-plugin');
  });

  it('starts with isLoading=true for a marketplace plugin before the API responds', async () => {
    let resolve: (value: boolean) => void;
    mockGetPluginEntitlement.mockReturnValue(new Promise<boolean>((res) => (resolve = res)));

    const { result } = renderHook(() => usePluginEntitlement(marketplacePlugin));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!(true);
    });

    expect(result.current).toEqual({ entitled: true, isLoading: false });
  });

  it('reuses cache and does not make a second API call when re-rendered with the same plugin', async () => {
    mockGetPluginEntitlement.mockResolvedValue(true);

    const { result, rerender } = renderHook(() => usePluginEntitlement(marketplacePlugin));

    await waitFor(() => {
      expect(result.current).toEqual({ entitled: true, isLoading: false });
    });

    rerender();

    expect(mockGetPluginEntitlement).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ entitled: true, isLoading: false });
  });

  it('makes a new API call and resets state when plugin id changes', async () => {
    const pluginA: CatalogPlugin = { ...marketplacePlugin, id: 'plugin-a' };
    const pluginB: CatalogPlugin = { ...marketplacePlugin, id: 'plugin-b' };

    mockGetPluginEntitlement.mockResolvedValue(true);

    const { result, rerender } = renderHook(({ plugin }) => usePluginEntitlement(plugin), {
      initialProps: { plugin: pluginA },
    });

    await waitFor(() => {
      expect(result.current).toEqual({ entitled: true, isLoading: false });
    });

    mockGetPluginEntitlement.mockResolvedValue(false);
    rerender({ plugin: pluginB });

    await waitFor(() => {
      expect(result.current).toEqual({ entitled: false, isLoading: false });
    });

    expect(mockGetPluginEntitlement).toHaveBeenCalledTimes(2);
    expect(mockGetPluginEntitlement).toHaveBeenCalledWith('plugin-a');
    expect(mockGetPluginEntitlement).toHaveBeenCalledWith('plugin-b');
  });

  it('does not update state after unmount if the fetch resolves after unmount', async () => {
    let resolve: (value: boolean) => void;
    mockGetPluginEntitlement.mockReturnValue(new Promise<boolean>((res) => (resolve = res)));

    const { unmount } = renderHook(() => usePluginEntitlement(marketplacePlugin));

    unmount();

    // Resolving after unmount must not throw or cause a state-update warning
    await act(async () => {
      resolve!(true);
    });

    // If the cancelled flag works correctly, no error is thrown and no state update occurs
    expect(mockGetPluginEntitlement).toHaveBeenCalledTimes(1);
  });
});
