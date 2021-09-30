import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { PluginListItemCard } from './PluginListItemCard';
import { CatalogPlugin } from '../types';

describe('PluginListItemCard', () => {
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
    version: '1.0.0',
    hasUpdate: false,
    isInstalled: false,
    isCore: false,
    isDev: false,
    isEnterprise: false,
    isDisabled: false,
  };

  it('renders a card with link, image, name, orgName and badges', () => {
    render(<PluginListItemCard plugin={plugin} pathName="/plugins" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin?page=overview');

    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', plugin.info.logos.small);
    expect(logo).toHaveAttribute('alt', `${plugin.name} logo`);

    expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
    expect(screen.getByText(`By ${plugin.orgName}`)).toBeVisible();
    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
  });

  it('renders a datasource plugin with correct icon', () => {
    const datasourcePlugin = { ...plugin, type: PluginType.datasource };
    render(<PluginListItemCard plugin={datasourcePlugin} pathName="" />);

    expect(screen.getByTestId(/datasource plugin icon/i)).toBeVisible();
  });

  it('renders a panel plugin with correct icon', () => {
    const panelPlugin = { ...plugin, type: PluginType.panel };
    render(<PluginListItemCard plugin={panelPlugin} pathName="" />);

    expect(screen.getByTestId(/panel plugin icon/i)).toBeVisible();
  });

  it('renders an app plugin with correct icon', () => {
    const appPlugin = { ...plugin, type: PluginType.app };
    render(<PluginListItemCard plugin={appPlugin} pathName="" />);

    expect(screen.getByTestId(/app plugin icon/i)).toBeVisible();
  });

  it('renders a disabled plugin with a badge to indicate its error', () => {
    const pluginWithError = { ...plugin, isDisabled: true, error: PluginErrorCode.modifiedSignature };
    render(<PluginListItemCard plugin={pluginWithError} pathName="" />);

    expect(screen.getByText(/disabled/i)).toBeVisible();
  });
});
