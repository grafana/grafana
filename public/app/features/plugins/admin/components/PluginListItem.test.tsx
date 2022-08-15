import { render, screen } from '@testing-library/react';
import React from 'react';

import { PluginErrorCode, PluginType } from '@grafana/data';

import { getCatalogPluginMock } from '../../__mocks__';
import { PluginListDisplayMode } from '../../types';

import { PluginListItem } from './PluginListItem';

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

  /** As Grid */
  it('renders a card with link, image, name, orgName and badges', () => {
    const plugin = getCatalogPluginMock();

    render(<PluginListItem plugin={plugin} pathName="/plugins" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin');

    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', plugin.logos?.small);

    expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
    expect(screen.getByText(`By ${plugin.orgName}`)).toBeVisible();
    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
  });

  it('renders a datasource plugin with correct icon', () => {
    render(<PluginListItem plugin={getCatalogPluginMock({ type: PluginType.datasource })} pathName="" />);

    expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
  });

  it('renders a panel plugin with correct icon', () => {
    render(<PluginListItem plugin={getCatalogPluginMock({ type: PluginType.panel })} pathName="" />);

    expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
  });

  it('renders an app plugin with correct icon', () => {
    render(<PluginListItem plugin={getCatalogPluginMock({ type: PluginType.app })} pathName="" />);

    expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
  });

  it('renders a disabled plugin with a badge to indicate its error', () => {
    render(
      <PluginListItem
        plugin={getCatalogPluginMock({ settings: { isDisabled: true }, error: PluginErrorCode.modifiedSignature })}
        pathName=""
      />
    );

    expect(screen.getByText(/disabled/i)).toBeVisible();
  });

  /** As List */
  it('renders a row with link, image, name, orgName and badges', () => {
    const plugin = getCatalogPluginMock();

    render(<PluginListItem plugin={plugin} pathName="/plugins" displayMode={PluginListDisplayMode.List} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/plugins/test-plugin');

    const logo = screen.getByRole('img');
    expect(logo).toHaveAttribute('src', plugin.logos?.small);

    expect(screen.getByRole('heading', { name: /testing plugin/i })).toBeVisible();
    expect(screen.getByText(`By ${plugin.orgName}`)).toBeVisible();
    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.queryByLabelText(/icon/i)).not.toBeInTheDocument();
  });

  it('renders a datasource plugin with correct icon', () => {
    render(
      <PluginListItem
        plugin={getCatalogPluginMock({ type: PluginType.datasource })}
        pathName=""
        displayMode={PluginListDisplayMode.List}
      />
    );

    expect(screen.getByTitle(/datasource plugin/i)).toBeInTheDocument();
  });

  it('renders a panel plugin with correct icon', () => {
    render(
      <PluginListItem
        plugin={getCatalogPluginMock({ type: PluginType.panel })}
        pathName=""
        displayMode={PluginListDisplayMode.List}
      />
    );

    expect(screen.getByTitle(/panel plugin/i)).toBeInTheDocument();
  });

  it('renders an app plugin with correct icon', () => {
    render(
      <PluginListItem
        plugin={getCatalogPluginMock({ type: PluginType.app })}
        pathName=""
        displayMode={PluginListDisplayMode.List}
      />
    );

    expect(screen.getByTitle(/app plugin/i)).toBeInTheDocument();
  });

  it('renders a disabled plugin with a badge to indicate its error', () => {
    render(
      <PluginListItem
        plugin={getCatalogPluginMock({ settings: { isDisabled: true }, error: PluginErrorCode.modifiedSignature })}
        pathName=""
        displayMode={PluginListDisplayMode.List}
      />
    );

    expect(screen.getByText(/disabled/i)).toBeVisible();
  });
});
