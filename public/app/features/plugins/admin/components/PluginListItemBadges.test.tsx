import { render, screen } from '@testing-library/react';
import React from 'react';

import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin } from '../types';

import { PluginListItemBadges } from './PluginListItemBadges';

describe('PluginListItemBadges', () => {
  const plugin: CatalogPlugin = {
    description: 'The test plugin',
    downloads: 5,
    id: 'test-plugin',
    info: {
      logos: {
        small: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/small',
        large: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/large',
      },
    },
    name: 'Testing Plugin',
    orgName: 'Test',
    popularity: 0,
    signature: PluginSignatureStatus.valid,
    publishedAt: '2020-09-01',
    updatedAt: '2021-06-28',
    hasUpdate: false,
    isInstalled: false,
    isCore: false,
    isDev: false,
    isEnterprise: false,
    isDisabled: false,
    isPublished: true,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a plugin signature badge', () => {
    render(<PluginListItemBadges plugin={plugin} />);

    expect(screen.getByText(/signed/i)).toBeVisible();
  });

  it('renders an installed badge', () => {
    render(<PluginListItemBadges plugin={{ ...plugin, isInstalled: true }} />);

    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.getByText(/installed/i)).toBeVisible();
  });

  it('renders an enterprise badge (when a license is valid)', () => {
    config.licenseInfo.enabledFeatures = { 'enterprise.plugins': true };
    render(<PluginListItemBadges plugin={{ ...plugin, isEnterprise: true }} />);
    expect(screen.getByText(/enterprise/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument();
  });

  it('renders an enterprise badge with icon and link (when a license is invalid)', () => {
    config.licenseInfo.enabledFeatures = {};
    render(<PluginListItemBadges plugin={{ ...plugin, isEnterprise: true }} />);
    expect(screen.getByText(/enterprise/i)).toBeVisible();
    expect(screen.getByLabelText(/lock icon/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
  });

  it('renders a error badge (when plugin has an error)', () => {
    render(<PluginListItemBadges plugin={{ ...plugin, isDisabled: true, error: PluginErrorCode.modifiedSignature }} />);
    expect(screen.getByText(/disabled/i)).toBeVisible();
  });

  it('renders an upgrade badge (when plugin has an available update)', () => {
    render(<PluginListItemBadges plugin={{ ...plugin, hasUpdate: true, installedVersion: '0.0.9' }} />);
    expect(screen.getByText(/update available/i)).toBeVisible();
  });
});
