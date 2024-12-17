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

const mockUseGetSingle = jest.requireMock('../state/hooks').useGetSingle;

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

  it('should show angular deprecation notice when angular is detected', () => {
    mockUseGetSingle.mockReturnValue({ ...plugin, angularDetected: true });
    render(<PluginDetailsPage pluginId="test-plugin" />);
    expect(screen.getByText(/legacy platform based on AngularJS/i)).toBeInTheDocument();
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
});
