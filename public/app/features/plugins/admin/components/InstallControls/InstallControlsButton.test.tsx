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

  describe('angular support disabled', () => {
    const angularSupportEnabled = false;

    it('disables install button for angular plugins', () => {
      setup({ angularSupportEnabled, angularDetected: true });
      const el = screen.getByRole('button');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      expect(el).toBeDisabled();
    });

    it('does not disable install button for non-angular plugins', () => {
      setup({ angularSupportEnabled, angularDetected: false });
      const el = screen.getByRole('button');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      expect(el).toBeEnabled();
    });
  });

  describe('angular support enabled', () => {
    const angularSupportEnabled = true;

    it('does nothing for angular plugins', () => {
      setup({ angularSupportEnabled, angularDetected: true });
      const el = screen.getByRole('button');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      expect(el).toBeEnabled();
    });

    it('does nothing for non-angular plugins', () => {
      setup({ angularSupportEnabled, angularDetected: false });
      const el = screen.getByRole('button');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      expect(el).toBeEnabled();
    });
  });
});
