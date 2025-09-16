import { render, screen } from '@testing-library/react';

import { PluginSignatureStatus } from '@grafana/data';
import { contextSrv } from 'app/core/core';

import * as runtime from '../state/hooks';
import { CatalogPlugin } from '../types';

import { PluginSubtitle, registerPluginSubtitleExtension } from './PluginSubtitle';

jest.mock('../state/hooks', () => ({
  useIsRemotePluginsAvailable: jest.fn().mockReturnValue(true),
  useInstallStatus: jest.fn().mockReturnValue({ error: null }),
}));

describe('PluginSubtitle', () => {
  const basePlugin: CatalogPlugin = {
    description: 'Test description',
    downloads: 5,
    id: 'test-plugin',
    name: 'Test Plugin',
    orgName: 'Test',
    signature: PluginSignatureStatus.valid,
    isInstalled: false,
    hasUpdate: false,
    isCore: false,
    isDev: false,
    details: {
      links: [{ name: 'Website', url: 'http://test.com' }],
      versions: [{ version: '1.0.0', grafanaDependency: '>=9.0.0', isCompatible: true, createdAt: '2020-01-01' }],
    },
    publishedAt: '2020-09-01',
    updatedAt: '2021-06-28',
    isEnterprise: false,
    isDisabled: false,
    isDeprecated: false,
    isPublished: true,
    isManaged: false,
    isPreinstalled: { found: false, withVersion: false },
    info: {
      logos: {
        small: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/small',
        large: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/large',
      },
      keywords: ['test', 'plugin'],
    },
    popularity: 0,
  };

  beforeEach(() => {});
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no plugin provided', () => {
    const { container } = render(<PluginSubtitle />);
    expect(container.firstChild).toBeNull();
  });

  it('renders plugin description', () => {
    render(<PluginSubtitle plugin={basePlugin} />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('shows error alert when installation error exists', () => {
    jest
      .spyOn(runtime, 'useInstallStatus')
      .mockReturnValueOnce({ error: { message: 'Install failed', error: 'Details' }, isInstalling: false });
    render(<PluginSubtitle plugin={basePlugin} />);
    expect(screen.getByText('Install failed')).toBeInTheDocument();
  });

  describe('warning when no permissions', () => {
    beforeEach(() => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    });

    it('renders install control warning when conditions are met', () => {
      const plugin = { ...basePlugin, isInstalled: false };
      render(<PluginSubtitle plugin={plugin} />);
      expect(screen.queryByText(/permission to install/i)).toBeInTheDocument();
    });

    it('renders uninstall control warning when conditions are met', () => {
      const plugin = { ...basePlugin, isInstalled: true };
      render(<PluginSubtitle plugin={plugin} />);
      expect(screen.queryByText(/permission to uninstall/i)).toBeInTheDocument();
    });
  });

  describe('no warning when has permissions', () => {
    beforeEach(() => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    });

    it('renders install control warning when conditions are met', () => {
      const plugin = { ...basePlugin, isInstalled: false };
      render(<PluginSubtitle plugin={plugin} />);
      expect(screen.queryByText(/permission to install/i)).not.toBeInTheDocument();
    });

    it('renders uninstall control warning when conditions are met', () => {
      const plugin = { ...basePlugin, isInstalled: true };
      render(<PluginSubtitle plugin={plugin} />);
      expect(screen.queryByText(/permission to uninstall/i)).not.toBeInTheDocument();
    });
  });
  it('renders plugin subtitle extensions', () => {
    const TestExtension = () => <div>Extension Content</div>;
    registerPluginSubtitleExtension(TestExtension);
    render(<PluginSubtitle plugin={basePlugin} />);
    expect(screen.getByText('Extension Content')).toBeInTheDocument();
  });
});
