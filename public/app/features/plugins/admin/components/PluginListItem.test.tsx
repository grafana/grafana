import React from 'react';
import { render, screen } from '@testing-library/react';
import { PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { PluginListItem } from './PluginListItem';
import { CatalogPlugin, PluginListDisplayMode } from '../types';

/**
 * The whole Icon component needs to be mock
 * currently is using react-inlinesvg that does not render the icon svg in the test.
 *
 * There is solution to mock the library on __mocks__
 * https://github.com/gilbarbara/react-inlinesvg/issues/145
 * But unfortunately that causes conflict with DashboardSearch.test.tsx
 */

jest.mock('@grafana/ui', () => {
  const IconMock = ({ title }: { title: string }) => {
    return (
      <svg>
        <title> {title} </title>
      </svg>
    );
  };
  IconMock.displayName = 'Icon';
  return Object.assign({}, jest.requireActual('@grafana/ui'), { Icon: IconMock });
});

describe('PluginListItem', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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

  /** As Grid */
  it('renders a card with link, image, name, orgName and badges', () => {
    render(<PluginListItem plugin={plugin} pathName="/plugins" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin');

    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', plugin.info.logos.small);

    expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
    expect(screen.getByText(`By ${plugin.orgName}`)).toBeVisible();
    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
  });

  it('renders a datasource plugin with correct icon', () => {
    const datasourcePlugin = { ...plugin, type: PluginType.datasource };
    render(<PluginListItem plugin={datasourcePlugin} pathName="" />);

    expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
  });

  it('renders a panel plugin with correct icon', () => {
    const panelPlugin = { ...plugin, type: PluginType.panel };
    render(<PluginListItem plugin={panelPlugin} pathName="" />);

    expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
  });

  it('renders an app plugin with correct icon', () => {
    const appPlugin = { ...plugin, type: PluginType.app };
    render(<PluginListItem plugin={appPlugin} pathName="" />);

    expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
  });

  it('renders a disabled plugin with a badge to indicate its error', () => {
    const pluginWithError = { ...plugin, isDisabled: true, error: PluginErrorCode.modifiedSignature };
    render(<PluginListItem plugin={pluginWithError} pathName="" />);

    expect(screen.getByText(/disabled/i)).toBeVisible();
  });

  /** As List */
  it('renders a row with link, image, name, orgName and badges', () => {
    render(<PluginListItem plugin={plugin} pathName="/plugins" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin');

    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', plugin.info.logos.small);

    expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
    expect(screen.getByText(`By ${plugin.orgName}`)).toBeVisible();
    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
  });

  it('renders a datasource plugin with correct icon', () => {
    const datasourcePlugin = { ...plugin, type: PluginType.datasource };
    render(<PluginListItem plugin={datasourcePlugin} pathName="" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
  });

  it('renders a panel plugin with correct icon', () => {
    const panelPlugin = { ...plugin, type: PluginType.panel };
    render(<PluginListItem plugin={panelPlugin} pathName="" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
  });

  it('renders an app plugin with correct icon', () => {
    const appPlugin = { ...plugin, type: PluginType.app };
    render(<PluginListItem plugin={appPlugin} pathName="" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
  });

  it('renders a disabled plugin with a badge to indicate its error', () => {
    const pluginWithError = { ...plugin, isDisabled: true, error: PluginErrorCode.modifiedSignature };
    render(<PluginListItem plugin={pluginWithError} pathName="" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByText(/disabled/i)).toBeVisible();
  });
});
