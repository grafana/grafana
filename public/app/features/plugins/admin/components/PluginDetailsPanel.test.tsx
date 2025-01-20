import { render, screen } from 'test/test-utils';

import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';

import { CatalogPlugin } from '../types';

import { PluginDetailsPanel } from './PluginDetailsPanel';

const mockPlugin: CatalogPlugin = {
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
  latestVersion: '1.1.0',
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

const mockInfo = [
  { label: 'Installed version', value: '1.0.0' },
  { label: 'Latest version', value: '1.2.0' },
  { label: 'Author', value: 'Test Author' },
];

describe('PluginDetailsPanel', () => {
  it('should render installed version when plugin is installed', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    const installedVersionLabel = screen.getByText('Installed version:');
    // Get the version text that's next to the label
    const installedVersion = installedVersionLabel.nextElementSibling;
    expect(installedVersionLabel).toBeInTheDocument();
    expect(installedVersion).toHaveTextContent('1.0.0');
  });

  it('should render latest version information', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    expect(screen.getByText('Latest version:')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
  });

  it('should render links section when plugin has links', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    const link = screen.getByText('Website');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://test-plugin.com');
  });

  it('should not render links section when plugin has no links', () => {
    const pluginWithoutLinks = {
      ...mockPlugin,
      details: { ...mockPlugin.details, links: [] },
    };
    render(<PluginDetailsPanel plugin={pluginWithoutLinks} pluginExtentionsInfo={mockInfo} />);
    expect(screen.queryByText('Links')).not.toBeInTheDocument();
    expect(screen.queryByText('Website')).not.toBeInTheDocument();
  });

  it('should render report abuse section for non-core plugins', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    expect(screen.getByText('Report a concern')).toBeInTheDocument();
    expect(screen.getByText('Contact Grafana Labs')).toBeInTheDocument();
  });

  it('should not render report abuse section for core plugins', () => {
    const corePlugin = { ...mockPlugin, isCore: true };
    render(<PluginDetailsPanel plugin={corePlugin} pluginExtentionsInfo={mockInfo} />);
    expect(screen.queryByText('Report a concern')).not.toBeInTheDocument();
  });

  it('should respect custom width prop', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} width="300px" />);
    const panel = screen.getByTestId('plugin-details-panel');
    expect(panel).toHaveStyle({ maxWidth: '300px' });
  });
});
