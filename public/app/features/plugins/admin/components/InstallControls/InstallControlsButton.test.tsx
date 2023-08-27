import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin, PluginStatus } from '../../types';

import { InstallControlsButton } from './InstallControlsButton';

const plugin: CatalogPlugin = {
  description: 'The test plugin',
  downloads: 5,
  id: 'test-plugin',
  info: {
    logos: { small: '', large: '' },
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

function setup(opts: { angularSupportEnabled: boolean; angularDetected: boolean }) {
  config.angularSupportEnabled = opts.angularSupportEnabled;
  render(
    <TestProvider>
      <InstallControlsButton
        plugin={{ ...plugin, angularDetected: opts.angularDetected }}
        pluginStatus={PluginStatus.INSTALL}
      />
    </TestProvider>
  );
}

describe('InstallControlsButton', () => {
  let oldAngularSupportEnabled = config.angularSupportEnabled;
  afterAll(() => {
    config.angularSupportEnabled = oldAngularSupportEnabled;
  });

  describe.each([{ angularSupportEnabled: true }, { angularSupportEnabled: false }])(
    'angular support is $angularSupportEnabled',
    ({ angularSupportEnabled }) => {
      it.each([
        { angularDetected: true, expectEnabled: angularSupportEnabled },
        { angularDetected: false, expectEnabled: true },
      ])('angular detected is $angularDetected', ({ angularDetected, expectEnabled }) => {
        setup({ angularSupportEnabled, angularDetected });

        const el = screen.getByRole('button');
        expect(el).toHaveTextContent(/install/i);
        expect(el).toBeVisible();
        if (expectEnabled) {
          expect(el).toBeEnabled();
        } else {
          expect(el).toBeDisabled();
        }
      });
    }
  );
});
