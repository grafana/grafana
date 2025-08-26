import { render, screen } from '@testing-library/react';

import { PluginSignatureStatus } from '@grafana/data';
import { contextSrv } from 'app/core/core';

import { usePluginConfig } from '../../hooks/usePluginConfig';
import { CatalogPlugin } from '../../types';

import { GetStartedWithApp } from './GetStartedWithApp';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

jest.mock('../../api', () => ({
  updatePluginSettings: jest.fn(),
}));

jest.mock('../../hooks/usePluginConfig', () => ({
  usePluginConfig: jest.fn(),
}));

const mockPlugin: CatalogPlugin = {
  id: 'test-plugin',
  name: 'Test Plugin',
  description: 'Test Plugin Description',
  downloads: 0,
  hasUpdate: false,
  info: {
    logos: {
      large: 'https://grafana.com/assets/img/brand/grafana_icon.svg',
      small: 'https://grafana.com/assets/img/brand/grafana_icon.svg',
    },
    keywords: [],
  },
  isDev: false,
  isCore: false,
  isEnterprise: false,
  isInstalled: false,
  isDisabled: false,
  isDeprecated: false,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
  isPublished: false,
  orgName: 'Test Org',
  signature: PluginSignatureStatus.valid,
  popularity: 0,
  publishedAt: '2021-01-01',
  updatedAt: '2021-01-01',
};

describe('GetStartedWithApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null if pluginConfig is not available', () => {
    (usePluginConfig as jest.Mock).mockReturnValue({ value: null });
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(true);

    const { container } = render(<GetStartedWithApp plugin={mockPlugin} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null if user does not have permission', () => {
    (usePluginConfig as jest.Mock).mockReturnValue({ value: { meta: {} } });
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(false);

    const { container } = render(<GetStartedWithApp plugin={mockPlugin} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders enable button if plugin is not enabled', () => {
    (usePluginConfig as jest.Mock).mockReturnValue({ value: { meta: { enabled: false } } });
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(true);

    render(<GetStartedWithApp plugin={mockPlugin} />);
    expect(screen.getByText('Enable')).toBeInTheDocument();
  });

  it('renders disable button if plugin is enabled and not autoEnabled', () => {
    (usePluginConfig as jest.Mock).mockReturnValue({ value: { meta: { enabled: true, autoEnabled: false } } });
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(true);

    render(<GetStartedWithApp plugin={mockPlugin} />);
    expect(screen.getByText('Disable')).toBeInTheDocument();
  });

  it('does not render disable button if plugin is enabled and autoEnabled', () => {
    (usePluginConfig as jest.Mock).mockReturnValue({ value: { meta: { enabled: true, autoEnabled: true } } });
    (contextSrv.hasPermission as jest.Mock).mockReturnValue(true);

    render(<GetStartedWithApp plugin={mockPlugin} />);
    expect(screen.queryByText('Disable')).not.toBeInTheDocument();
  });
});
