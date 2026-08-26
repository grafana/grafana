import { renderHook, waitFor } from '@testing-library/react';

import { config, isAppPluginEnabled } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';

import { isDatabaseAttribute } from '../attributeCategories';

import { getAttributePluginPromos, useAttributePluginPromoGetter } from './attributePluginPromos';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isAppPluginEnabled: jest.fn(),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useAppPluginMetas: jest.fn(),
}));

const mockUseAppPluginMetas = jest.mocked(useAppPluginMetas);
const mockIsAppPluginEnabled = jest.mocked(isAppPluginEnabled);

describe('getAttributePluginPromos', () => {
  const originalNamespace = config.namespace;

  afterEach(() => {
    config.namespace = originalNamespace;
  });

  it('includes Database Observability promo for db.* attributes on Cloud', () => {
    config.namespace = 'stacks-12345';

    const promos = getAttributePluginPromos();
    const dbPromo = promos.find((promo) => promo.pluginId === 'grafana-dbo11y-app');

    expect(dbPromo).toBeDefined();
    expect(dbPromo!.match('db.system')).toBe(true);
    expect(dbPromo!.match('db.namespace')).toBe(true);
    expect(dbPromo!.match('http.method')).toBe(false);
    expect(isDatabaseAttribute('db.system')).toBe(true);
  });

  it('omits Database Observability promo on on-prem', () => {
    config.namespace = 'default';

    expect(getAttributePluginPromos()).toEqual([]);
  });
});

describe('useAttributePluginPromoGetter', () => {
  const originalNamespace = config.namespace;

  beforeEach(() => {
    config.namespace = 'stacks-12345';
    mockIsAppPluginEnabled.mockResolvedValue(false);
  });

  afterEach(() => {
    config.namespace = originalNamespace;
    jest.clearAllMocks();
  });

  it('returns no promo while plugin metas are loading', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: true, error: undefined, value: undefined });

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
    expect(mockIsAppPluginEnabled).not.toHaveBeenCalled();
  });

  it('returns no promo when plugin metas are unavailable', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: new Error('failed'), value: undefined });

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
    expect(mockIsAppPluginEnabled).not.toHaveBeenCalled();
  });

  it('returns a promo when the matching plugin is not installed', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(result.current('db.system')?.pluginId).toBe('grafana-dbo11y-app');
    });
    expect(result.current('http.method')).toBeUndefined();
    expect(mockIsAppPluginEnabled).not.toHaveBeenCalled();
  });

  it('returns a promo when the matching plugin is installed but not activated', async () => {
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-dbo11y-app' } as never],
    });
    mockIsAppPluginEnabled.mockResolvedValue(false);

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(result.current('db.system')?.pluginId).toBe('grafana-dbo11y-app');
    });
    expect(mockIsAppPluginEnabled).toHaveBeenCalledWith('grafana-dbo11y-app');
  });

  it('returns no promo when the matching plugin is installed and activated', async () => {
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-dbo11y-app' } as never],
    });
    mockIsAppPluginEnabled.mockResolvedValue(true);

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(mockIsAppPluginEnabled).toHaveBeenCalledWith('grafana-dbo11y-app');
    });
    expect(result.current('db.system')).toBeUndefined();
  });

  it('returns no promo on on-prem', async () => {
    config.namespace = 'default';
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const { result } = renderHook(() => useAttributePluginPromoGetter());

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
  });
});
