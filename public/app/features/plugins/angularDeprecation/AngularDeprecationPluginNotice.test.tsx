import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PluginType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { AngularDeprecationPluginNotice } from './AngularDeprecationPluginNotice';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('AngularDeprecationPluginNotice', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('Plugin type message', () => {
    const tests = [
      {
        name: 'undefined (default)',
        pluginType: undefined,
        expected: /This plugin uses/i,
      },
      {
        name: 'app',
        pluginType: PluginType.app,
        expected: /This app plugin uses/i,
      },
      {
        name: 'panel',
        pluginType: PluginType.panel,
        expected: /This panel plugin uses/i,
      },
      {
        name: 'data source',
        pluginType: PluginType.datasource,
        expected: /This data source plugin uses/i,
      },
    ];
    tests.forEach((test) => {
      it(`displays the correct plugin type for ${test.name}`, () => {
        render(<AngularDeprecationPluginNotice pluginId="test-id" pluginType={test.pluginType} />);
        expect(screen.getByText(test.expected)).toBeInTheDocument();
      });
    });
  });

  describe('Angular configuration', () => {
    const tests = [
      {
        name: 'undefined (default)',
        angularSupportEnabled: undefined,
        expected: /may be incompatible/i,
      },
      {
        name: 'true',
        angularSupportEnabled: true,
        expected: /will stop working/i,
      },
      {
        name: 'false',
        angularSupportEnabled: false,
        expected: /is incompatible/i,
      },
    ];
    tests.forEach((test) => {
      it(`displays the correct angular configuration for ${test.name}`, () => {
        render(
          <AngularDeprecationPluginNotice pluginId="test-id" angularSupportEnabled={test.angularSupportEnabled} />
        );
        expect(screen.getByText(test.expected)).toBeInTheDocument();
      });
    });
  });

  it('displays the plugin details link if showPluginDetailsLink is true', () => {
    render(<AngularDeprecationPluginNotice pluginId="test-id" showPluginDetailsLink={true} />);
    const detailsLink = screen.getByText(/view plugin details/i);
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute('href', 'plugins/test-id');
  });

  it('does not display the plugin details link if showPluginDetailsLink is false', () => {
    render(<AngularDeprecationPluginNotice pluginId="test-id" showPluginDetailsLink={false} />);
    expect(screen.queryByText(/view plugin details/i)).not.toBeInTheDocument();
  });

  it('reports interaction when clicking on the link', async () => {
    render(<AngularDeprecationPluginNotice pluginId="test-id" interactionElementId="some-identifier" />);
    const c = 'Read our deprecation notice and migration advice.';
    expect(screen.getByText(c)).toBeInTheDocument();
    await userEvent.click(screen.getByText(c));
    expect(reportInteraction).toHaveBeenCalledWith('angular_deprecation_docs_clicked', {
      pluginId: 'test-id',
      elementId: 'some-identifier',
    });
  });
});
