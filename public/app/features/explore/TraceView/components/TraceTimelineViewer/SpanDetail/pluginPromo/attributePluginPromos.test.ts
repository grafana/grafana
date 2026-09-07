import { renderHook, waitFor } from '@testing-library/react';

import { config, isAppPluginEnabled } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';

import {
  isDatabaseAttribute,
  isFrontendObservabilityAttribute,
  isKnowledgeGraphAttribute,
  isKubernetesAttribute,
  isServiceAttribute,
} from '../attributeCategories';

import {
  getAttributePluginPromos,
  MAX_ATTRIBUTE_PLUGIN_PROMOS,
  selectAttributeKeysForPromos,
  useAttributePluginPromoGetter,
} from './attributePluginPromos';

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

  it('includes promos for other observability apps with expected matchers on Cloud', () => {
    config.namespace = 'stacks-12345';

    const promos = getAttributePluginPromos();

    expect(promos.find((promo) => promo.pluginId === 'grafana-kowalski-app')?.match('session.id')).toBe(true);
    expect(promos.find((promo) => promo.pluginId === 'grafana-app-observability-app')?.match('service.name')).toBe(
      true
    );
    expect(promos.find((promo) => promo.pluginId === 'grafana-k8s-app')?.match('k8s.pod.name')).toBe(true);
    expect(promos.find((promo) => promo.pluginId === 'grafana-asserts-app')?.match('service.name')).toBe(true);
    expect(promos.find((promo) => promo.pluginId === 'grafana-asserts-app')?.match('k8s.cluster.name')).toBe(false);
    expect(promos.find((promo) => promo.pluginId === 'grafana-k8s-app')?.match('k8s.cluster.name')).toBe(true);

    expect(isFrontendObservabilityAttribute('session.id')).toBe(true);
    expect(isServiceAttribute('service.name')).toBe(true);
    expect(isKubernetesAttribute('k8s.pod.name')).toBe(true);
    expect(isKnowledgeGraphAttribute('service.name')).toBe(true);
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

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system']));

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
    expect(mockIsAppPluginEnabled).not.toHaveBeenCalled();
  });

  it('returns no promo when plugin metas are unavailable', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: new Error('failed'), value: undefined });

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system']));

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
    expect(mockIsAppPluginEnabled).not.toHaveBeenCalled();
  });

  it('returns a promo when the matching plugin is not installed', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system', 'http.method']));

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

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system']));

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

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system']));

    await waitFor(() => {
      expect(mockIsAppPluginEnabled).toHaveBeenCalledWith('grafana-dbo11y-app');
    });
    expect(result.current('db.system')).toBeUndefined();
  });

  it('prefers Knowledge Graph when multiple plugins match the same attribute', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const { result } = renderHook(() => useAttributePluginPromoGetter(['service.name']));

    await waitFor(() => {
      expect(result.current('service.name')?.pluginId).toBe('grafana-asserts-app');
    });
  });

  it('falls back to App O11y promo for service attributes when Knowledge Graph is active', async () => {
    mockUseAppPluginMetas.mockReturnValue({
      loading: false,
      error: undefined,
      value: [{ id: 'grafana-asserts-app' } as never],
    });
    mockIsAppPluginEnabled.mockImplementation(async (pluginId) => pluginId === 'grafana-asserts-app');

    const { result } = renderHook(() => useAttributePluginPromoGetter(['service.name']));

    await waitFor(() => {
      expect(result.current('service.name')?.pluginId).toBe('grafana-app-observability-app');
    });
  });

  it('limits promos to MAX_ATTRIBUTE_PLUGIN_PROMOS attribute keys', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const keys = [
      'service.name',
      'service.namespace',
      'db.system',
      'db.statement',
      'session.id',
      'k8s.pod.name',
      'k8s.cluster.name',
    ];
    const { result } = renderHook(() => useAttributePluginPromoGetter(keys));

    await waitFor(() => {
      expect(result.current('service.name')?.pluginId).toBe('grafana-asserts-app');
    });

    const promoted = keys.filter((key) => result.current(key) !== undefined);
    expect(promoted).toHaveLength(MAX_ATTRIBUTE_PLUGIN_PROMOS);
    expect(promoted).toEqual(['service.name', 'db.system', 'session.id']);
    expect(result.current('k8s.pod.name')).toBeUndefined();
    expect(result.current('service.namespace')).toBeUndefined();
  });

  it('assigns overlapping service keys to different inactive plugins', async () => {
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const keys = ['service.name', 'service.version', 'db.system'];
    const { result } = renderHook(() => useAttributePluginPromoGetter(keys));

    await waitFor(() => {
      expect(result.current('service.name')?.pluginId).toBe('grafana-asserts-app');
    });
    expect(result.current('service.version')?.pluginId).toBe('grafana-app-observability-app');
    expect(result.current('db.system')?.pluginId).toBe('grafana-dbo11y-app');
  });

  it('returns no promo on on-prem', async () => {
    config.namespace = 'default';
    mockUseAppPluginMetas.mockReturnValue({ loading: false, error: undefined, value: [] });

    const { result } = renderHook(() => useAttributePluginPromoGetter(['db.system']));

    await waitFor(() => {
      expect(result.current('db.system')).toBeUndefined();
    });
  });
});

describe('selectAttributeKeysForPromos', () => {
  const originalNamespace = config.namespace;

  beforeEach(() => {
    config.namespace = 'stacks-12345';
  });

  afterEach(() => {
    config.namespace = originalNamespace;
  });

  it('selects at most one key per inactive plugin up to the max', () => {
    const promos = getAttributePluginPromos();
    const inactive = new Set(promos.map((promo) => promo.pluginId));

    const selected = selectAttributeKeysForPromos(
      ['service.name', 'service.version', 'db.system', 'db.name', 'session.id', 'k8s.pod.name'],
      inactive,
      promos
    );

    expect([...selected.keys()]).toEqual(['service.name', 'db.system', 'session.id']);
    expect(selected.get('service.name')?.pluginId).toBe('grafana-asserts-app');
    expect(selected.get('db.system')?.pluginId).toBe('grafana-dbo11y-app');
    expect(selected.get('session.id')?.pluginId).toBe('grafana-kowalski-app');
  });

  it('maps a second overlapping service key to App O11y, not Knowledge Graph', () => {
    const promos = getAttributePluginPromos();
    const inactive = new Set(promos.map((promo) => promo.pluginId));

    const selected = selectAttributeKeysForPromos(['service.name', 'service.version', 'db.system'], inactive, promos);

    expect(selected.get('service.name')?.pluginId).toBe('grafana-asserts-app');
    expect(selected.get('service.version')?.pluginId).toBe('grafana-app-observability-app');
    expect(selected.get('db.system')?.pluginId).toBe('grafana-dbo11y-app');
  });

  it('skips active plugins and fills remaining slots from lower-priority promos', () => {
    const promos = getAttributePluginPromos();
    const inactive = new Set(['grafana-dbo11y-app', 'grafana-k8s-app', 'grafana-app-observability-app']);

    const selected = selectAttributeKeysForPromos(
      ['service.name', 'db.system', 'k8s.pod.name', 'session.id'],
      inactive,
      promos
    );

    expect([...selected.keys()]).toEqual(['db.system', 'service.name', 'k8s.pod.name']);
    expect(selected.get('service.name')?.pluginId).toBe('grafana-app-observability-app');
    expect(selected.get('db.system')?.pluginId).toBe('grafana-dbo11y-app');
    expect(selected.get('k8s.pod.name')?.pluginId).toBe('grafana-k8s-app');
  });
});
