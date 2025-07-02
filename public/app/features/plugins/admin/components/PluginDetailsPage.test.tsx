import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin } from '../types';

import { PluginDetailsPage } from './PluginDetailsPage';

const plugin: CatalogPlugin = {
  description: 'Test plugin description',
  downloads: 1000,
  hasUpdate: false,
  id: 'test-plugin',
  info: {
    logos: {
      small: 'small-logo-url',
      large: 'large-logo-url',
    },
    keywords: ['test', 'plugin'],
  },
  isDev: false,
  isCore: false,
  isEnterprise: false,
  isInstalled: true,
  isDisabled: false,
  isDeprecated: false,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
  isPublished: true,
  name: 'Test Plugin',
  orgName: 'Test Org',
  signature: PluginSignatureStatus.valid,
  signatureType: PluginSignatureType.grafana,
  signatureOrg: 'Test Signature Org',
  popularity: 4,
  publishedAt: '2023-01-01',
  type: PluginType.app,
  updatedAt: '2023-12-01',
  installedVersion: '1.0.0',
  details: {
    readme: 'Test readme',
    versions: [
      {
        version: '1.0.0',
        createdAt: '2023-01-01',
        isCompatible: true,
        grafanaDependency: '>=9.0.0',
        angularDetected: false,
      },
    ],
    links: [
      {
        name: 'Website',
        url: 'https://test-plugin.com',
      },
    ],
    grafanaDependency: '>=9.0.0',
    statusContext: 'stable',
    changelog: 'Test changelog',
  },
  angularDetected: false,
  isFullyInstalled: true,
  accessControl: {},
};

jest.mock('../state/hooks', () => ({
  useGetSingle: jest.fn(),
  useFetchStatus: jest.fn().mockReturnValue({ isLoading: false }),
  useFetchDetailsStatus: () => ({ isLoading: false }),
  useIsRemotePluginsAvailable: () => false,
  useInstallStatus: () => ({ error: null, isInstalling: false }),
  useUninstallStatus: () => ({ error: null, isUninstalling: false }),
  useInstall: () => jest.fn(),
  useUninstall: () => jest.fn(),
  useUnsetInstall: () => jest.fn(),
  useFetchDetailsLazy: () => jest.fn(),
}));

jest.mock('../hooks/usePluginConfig', () => ({
  usePluginConfig: jest.fn().mockReturnValue({ value: {}, loading: false }),
}));

const mockUseGetSingle = jest.requireMock('../state/hooks').useGetSingle;
const mockUsePluginConfig = jest.requireMock('../hooks/usePluginConfig').usePluginConfig;

describe('PluginDetailsPage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
    mockUseGetSingle.mockReturnValue(plugin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show loader when fetching plugin details', () => {
    jest.requireMock('../state/hooks').useFetchStatus.mockReturnValueOnce({ isLoading: true });
    render(<PluginDetailsPage pluginId="test-plugin" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show not found component when plugin doesnt exist', () => {
    mockUseGetSingle.mockReturnValue(undefined);
    render(<PluginDetailsPage pluginId="not-exist" />);
    expect(screen.getByText('Plugin not found')).toBeInTheDocument();
  });

  it('should not show right panel when feature toggle is disabled', () => {
    config.featureToggles.pluginsDetailsRightPanel = false;
    render(<PluginDetailsPage pluginId="test-plugin" />);
    expect(screen.queryByTestId('plugin-details-panel')).not.toBeInTheDocument();
  });

  it('should show right panel when feature toggle is enabled and screen is wide', () => {
    config.featureToggles.pluginsDetailsRightPanel = true;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query !== '(max-width: 600px)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<PluginDetailsPage pluginId="test-plugin" />);
    expect(screen.getByTestId('plugin-details-panel')).toBeInTheDocument();
  });

  it('should show "Plugin details" tab when screen is narrow', () => {
    config.featureToggles.pluginsDetailsRightPanel = true;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(max-width: 600px)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<PluginDetailsPage pluginId="test-plugin" />);
    expect(screen.getByRole('tab', { name: 'Plugin details' })).toBeInTheDocument();
  });

  it('should show "Datasource connections" tab when plugin is type of datasource', () => {
    config.featureToggles.datasourceConnectionsTab = true;
    mockUseGetSingle.mockReturnValue({ ...plugin, type: PluginType.datasource });
    mockUsePluginConfig.mockReturnValue({ value: {}, loading: false });
    render(<PluginDetailsPage pluginId={plugin.id} />);
    expect(screen.getByRole('tab', { name: 'Data source connections' })).toBeVisible();
  });

  it('should not show version and changelog tabs when plugin is core', () => {
    mockUseGetSingle.mockReturnValue({ ...plugin, isCore: true });
    render(<PluginDetailsPage pluginId={plugin.id} />);
    expect(screen.queryByRole('tab', { name: 'Version history' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Changelog' })).not.toBeInTheDocument();
  });

  it('should not show last version in plugin details panel when plugin is core', () => {
    config.featureToggles.pluginsDetailsRightPanel = true;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query !== '(max-width: 600px)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    mockUseGetSingle.mockReturnValue({ ...plugin, isCore: true, latestVersion: '1.2.0' });

    render(<PluginDetailsPage pluginId={plugin.id} />);
    expect(screen.queryByText('Latest Version:')).not.toBeInTheDocument();
  });
});
