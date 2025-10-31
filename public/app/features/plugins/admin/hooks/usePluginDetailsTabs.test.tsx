import { renderHook } from '@testing-library/react';

import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin } from '../types';

import { usePluginDetailsTabs } from './usePluginDetailsTabs';

jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: () => ({ pathname: '/plugins/test-plugin' }),
}));

jest.mock('./usePluginConfig');

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermissionInMetadata: jest.fn(() => true),
  },
}));

const mockUsePluginConfig = jest.requireMock('./usePluginConfig').usePluginConfig;

const mockPlugin: CatalogPlugin = {
  id: 'test-plugin',
  name: 'Test Plugin',
  description: 'Test plugin description',
  type: PluginType.app,
  isPublished: true,
  isInstalled: true,
  isCore: false,
  isDev: false,
  isDisabled: false,
  isDeprecated: false,
  isEnterprise: false,
  isFullyInstalled: true,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
  hasUpdate: false,
  info: {
    logos: { small: '', large: '' },
    keywords: [],
  },
  orgName: 'Test',
  signature: PluginSignatureStatus.valid,
  signatureType: PluginSignatureType.grafana,
  signatureOrg: 'Grafana',
  popularity: 1,
  downloads: 100,
  updatedAt: '2023-01-01',
  publishedAt: '2023-01-01',
  angularDetected: false,
  accessControl: {},
};

const mockPluginConfig = {
  meta: {
    id: 'test-plugin',
    name: 'Test Plugin',
    type: PluginType.app,
    module: 'test',
    baseUrl: '',
    info: {
      author: { name: 'Test' },
      description: 'Test plugin',
      logos: { small: '', large: '' },
      links: [],
      screenshots: [],
      updated: '2023-01-01',
      version: '1.0.0',
      keywords: [],
    },
  },
  configPages: [
    {
      id: 'config-page-1',
      title: 'Configuration',
      icon: 'cog',
      body: () => null,
    },
  ],
};

describe('usePluginDetailsTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.externalServiceAccounts = false;
  });

  it('should not include config-specific tabs while plugin config is loading', () => {
    // simulate the race condition: plugin is loaded but config is still loading
    mockUsePluginConfig.mockReturnValue({
      loading: true,
      error: undefined,
      value: null,
    });

    const { result } = renderHook(() => usePluginDetailsTabs(mockPlugin, undefined, false));

    // should NOT include config page tabs while loading
    const configTab = result.current.navModel.children?.find((tab) => tab.id === 'config-page-1');
    expect(configTab).toBeUndefined();

    // should include basic tabs
    const overviewTab = result.current.navModel.children?.find((tab) => tab.id === 'overview');
    expect(overviewTab).toBeDefined();
  });

  it('should include config-specific tabs when plugin config is loaded', () => {
    // simulate config loaded successfully
    mockUsePluginConfig.mockReturnValue({
      loading: false,
      error: undefined,
      value: mockPluginConfig,
    });

    const { result } = renderHook(() => usePluginDetailsTabs(mockPlugin, undefined, false));

    // should NOW include config page tabs
    const configTab = result.current.navModel.children?.find((tab) => tab.id === 'config-page-1');
    expect(configTab).toBeDefined();
    expect(configTab?.text).toBe('Configuration');
  });
});
