import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { type CatalogPlugin } from '../types';

import { usePluginDetailsTabs } from './usePluginDetailsTabs';

jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: () => ({ pathname: '/plugins/test-plugin' }),
}));

jest.mock('./usePluginConfig');

jest.mock('app/core/services/context_srv', () => ({
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
  managed: { enabled: false, strategy: undefined },
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

const wrapper = ({ children }: PropsWithChildren) => (
  <OpenFeatureProvider client={getTestFeatureFlagClient()}>{children}</OpenFeatureProvider>
);

describe('usePluginDetailsTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.externalServiceAccounts = false;
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('should not include config-specific tabs while plugin config is loading', () => {
    // simulate the race condition: plugin is loaded but config is still loading
    mockUsePluginConfig.mockReturnValue({
      loading: true,
      error: undefined,
      value: null,
    });

    const { result } = renderHook(() => usePluginDetailsTabs(mockPlugin, undefined, false), { wrapper });

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

    const { result } = renderHook(() => usePluginDetailsTabs(mockPlugin, undefined, false), { wrapper });

    // should NOW include config page tabs
    const configTab = result.current.navModel.children?.find((tab) => tab.id === 'config-page-1');
    expect(configTab).toBeDefined();
    expect(configTab?.text).toBe('Configuration');
  });

  it('should default to overview tab for grafana-assistant-app', () => {
    mockUsePluginConfig.mockReturnValue({
      loading: false,
      error: undefined,
      value: mockPluginConfig,
    });

    const assistantPlugin = { ...mockPlugin, id: 'grafana-assistant-app' };
    const { result } = renderHook(() => usePluginDetailsTabs(assistantPlugin, undefined, false), {
      wrapper,
    });

    expect(result.current.activePageId).toBe('overview');
  });

  describe('data source connections tab', () => {
    const datasourcePlugin = { ...mockPlugin, type: PluginType.datasource };

    beforeEach(() => {
      mockUsePluginConfig.mockReturnValue({
        loading: false,
        error: undefined,
        value: { ...mockPluginConfig, meta: { ...mockPluginConfig.meta, type: PluginType.datasource } },
      });
    });

    it('should include the connections tab for data source plugins when the datasourceConnectionsTab flag is on', () => {
      setTestFlags({ [FlagKeys.DatasourceConnectionsTab]: true });

      const { result } = renderHook(() => usePluginDetailsTabs(datasourcePlugin, undefined, false), { wrapper });

      const connectionsTab = result.current.navModel.children?.find((tab) => tab.id === 'datasource-connections');
      expect(connectionsTab?.text).toBe('Data source connections');
    });

    it('should not include the connections tab when the datasourceConnectionsTab flag is off', () => {
      const { result } = renderHook(() => usePluginDetailsTabs(datasourcePlugin, undefined, false), { wrapper });

      expect(result.current.navModel.children?.find((tab) => tab.id === 'usage')).toBeDefined();
      expect(result.current.navModel.children?.find((tab) => tab.id === 'datasource-connections')).toBeUndefined();
    });
  });
});
