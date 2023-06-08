import { render, screen } from '@testing-library/react';
import React from 'react';

import { config } from '@grafana/runtime';

import { PluginStatus } from '../../types';

import { ExternallyManagedButton } from './ExternallyManagedButton';

function setup(opts: { angularSupportEnabled: boolean; angularDetected: boolean }) {
  config.angularSupportEnabled = opts.angularSupportEnabled;
  render(
    <ExternallyManagedButton
      pluginId={'some-plugin-id'}
      angularDetected={opts.angularDetected}
      pluginStatus={PluginStatus.INSTALL}
    />
  );
}

describe('ExternallyManagedButton', () => {
  let oldAngularSupportEnabled = config.angularSupportEnabled;
  afterAll(() => {
    config.angularSupportEnabled = oldAngularSupportEnabled;
  });

  const linkDisabledStyle = 'pointer-events: none';

  describe('angular support disabled', () => {
    const angularSupportEnabled = false;
    it.each([
      { angularDetected: true, expectDisabled: true },
      { angularDetected: false, expectDisabled: false },
    ])('%s', ({ angularDetected, expectDisabled }) => {
      setup({ angularSupportEnabled, angularDetected });

      const el = screen.getByRole('link');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      if (expectDisabled) {
        expect(el).toHaveStyle(linkDisabledStyle);
      } else {
        expect(el).not.toHaveStyle(linkDisabledStyle);
      }
    });
  });

  describe('angular support enabled', () => {
    const angularSupportEnabled = true;
    it.each([{ angularDetected: true }, { angularDetected: false }])('%s', ({ angularDetected }) => {
      setup({ angularSupportEnabled, angularDetected });

      const el = screen.getByRole('link');
      expect(el).toHaveTextContent(/install/i);
      expect(el).toBeVisible();
      expect(el).not.toHaveStyle(linkDisabledStyle);
    });
  });
});
