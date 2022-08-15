import { render, screen } from '@testing-library/react';
import React from 'react';

import { PluginErrorCode } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getCatalogPluginMock } from '../__mocks__';

import { PluginListItemBadges } from './PluginListItemBadges';

describe('PluginListItemBadges', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a plugin signature badge', () => {
    render(<PluginListItemBadges plugin={getCatalogPluginMock()} />);

    expect(screen.getByText(/signed/i)).toBeVisible();
  });

  it('renders an installed badge', () => {
    render(<PluginListItemBadges plugin={getCatalogPluginMock({ settings: { isInstalled: true } })} />);

    expect(screen.getByText(/signed/i)).toBeVisible();
    expect(screen.getByText(/installed/i)).toBeVisible();
  });

  it('renders an enterprise badge (when a license is valid)', () => {
    config.licenseInfo.enabledFeatures = { 'enterprise.plugins': true };
    render(<PluginListItemBadges plugin={getCatalogPluginMock({ info: { isEnterprise: true } })} />);
    expect(screen.getByText(/enterprise/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument();
  });

  it('renders an enterprise badge with icon and link (when a license is invalid)', () => {
    config.licenseInfo.enabledFeatures = {};
    render(<PluginListItemBadges plugin={getCatalogPluginMock({ info: { isEnterprise: true } })} />);
    expect(screen.getByText(/enterprise/i)).toBeVisible();
    expect(screen.getByLabelText(/lock icon/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
  });

  it('renders a error badge (when plugin has an error)', () => {
    render(
      <PluginListItemBadges
        plugin={getCatalogPluginMock({ settings: { isDisabled: true }, error: PluginErrorCode.modifiedSignature })}
      />
    );
    expect(screen.getByText(/disabled/i)).toBeVisible();
  });

  it('renders an upgrade badge (when plugin has an available update)', () => {
    render(<PluginListItemBadges plugin={getCatalogPluginMock({ settings: { hasUpdate: true, version: '0.0.9' } })} />);
    expect(screen.getByText(/update available/i)).toBeVisible();
  });
});
