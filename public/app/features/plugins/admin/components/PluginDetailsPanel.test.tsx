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
      {
        name: 'Repository',
        url: 'https://github.com/grafana/test-plugin',
      },
      {
        name: 'License',
        url: 'https://github.com/grafana/test-plugin/blob/main/LICENSE',
      },
      {
        name: 'Documentation',
        url: 'https://test-plugin.com/docs',
      },
      {
        name: 'Raise issue',
        url: 'https://github.com/grafana/test-plugin/issues/new',
      },
    ],
    raiseAnIssueUrl: 'https://github.com/grafana/test-plugin/issues/new',
    documentationUrl: 'https://test-plugin.com/docs',
    licenseUrl: 'https://github.com/grafana/test-plugin/blob/main/LICENSE',
    sponsorshipUrl: 'https://github.com/sponsors/grafana',
    repositoryUrl: 'https://github.com/grafana/test-plugin',
    grafanaDependency: '>=9.0.0',
    statusContext: 'stable',
  },
  angularDetected: false,
  isFullyInstalled: true,
  accessControl: {},
  url: 'https://github.com/grafana/test-plugin',
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
  });

  it('should not render report abuse section for core plugins', () => {
    const corePlugin = { ...mockPlugin, isCore: true };
    render(<PluginDetailsPanel plugin={corePlugin} pluginExtentionsInfo={mockInfo} />);
    expect(screen.queryByText('Report a concern')).not.toBeInTheDocument();
  });

  it('should respect custom width prop', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} width="300px" />);
    const panel = screen.getByTestId('plugin-details-panel');
    expect(panel).toHaveStyle({ width: '300px' });
  });

  it('should render license, documentation, repository, raise issue, sponsorship links', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    const repositoryLink = screen.getByTestId('plugin-details-repository-link');
    const licenseLink = screen.getByTestId('plugin-details-license-link');
    const documentationLink = screen.getByTestId('plugin-details-documentation-link');
    const raiseIssueLink = screen.getByTestId('plugin-details-raise-issue-link');
    const sponsorshipLink = screen.getByTestId('plugin-details-sponsorship-link');

    expect(repositoryLink).toBeInTheDocument();
    expect(repositoryLink).toHaveAttribute('href', 'https://github.com/grafana/test-plugin');
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink).toHaveAttribute('href', 'https://github.com/grafana/test-plugin/blob/main/LICENSE');
    expect(documentationLink).toBeInTheDocument();
    expect(documentationLink).toHaveAttribute('href', 'https://test-plugin.com/docs');
    expect(raiseIssueLink).toBeInTheDocument();
    expect(raiseIssueLink).toHaveAttribute('href', 'https://github.com/grafana/test-plugin/issues/new');
    expect(sponsorshipLink).toBeInTheDocument();
    expect(sponsorshipLink).toHaveAttribute('href', 'https://github.com/sponsors/grafana');
  });

  it('should not render license, documentation, repository, raise issue links in custom links', () => {
    render(<PluginDetailsPanel plugin={mockPlugin} pluginExtentionsInfo={mockInfo} />);
    const repositoryLink = screen.getByTestId('plugin-details-repository-link');
    const licenseLink = screen.getByTestId('plugin-details-license-link');
    const documentationLink = screen.getByTestId('plugin-details-documentation-link');
    const raiseIssueLink = screen.getByTestId('plugin-details-raise-issue-link');
    const websiteLink = screen.getByText('Website');

    const customLinks = screen.getByTestId('plugin-details-custom-links');

    expect(customLinks).not.toContainElement(repositoryLink);
    expect(customLinks).not.toContainElement(licenseLink);
    expect(customLinks).not.toContainElement(documentationLink);
    expect(customLinks).not.toContainElement(raiseIssueLink);
    expect(customLinks).toContainElement(websiteLink);

    const regularLinks = screen.getByTestId('plugin-details-regular-links');

    expect(regularLinks).toContainElement(repositoryLink);
    expect(regularLinks).toContainElement(licenseLink);
    expect(regularLinks).toContainElement(documentationLink);
    expect(regularLinks).toContainElement(raiseIssueLink);
    expect(regularLinks).not.toContainElement(websiteLink);
  });
});
