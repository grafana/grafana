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

  describe.each([{ angularSupportEnabled: true }, { angularSupportEnabled: false }])(
    'angular support is $angularSupportEnabled',
    ({ angularSupportEnabled }) => {
      it.each([
        { angularDetected: true, expectEnabled: angularSupportEnabled },
        { angularDetected: false, expectEnabled: true },
      ])('angular detected is $angularDetected', ({ angularDetected, expectEnabled }) => {
        setup({ angularSupportEnabled, angularDetected });

        const el = screen.getByRole('link');
        expect(el).toHaveTextContent(/install/i);
        expect(el).toBeVisible();
        const linkDisabledStyle = 'pointer-events: none';
        if (expectEnabled) {
          expect(el).not.toHaveStyle(linkDisabledStyle);
        } else {
          expect(el).toHaveStyle(linkDisabledStyle);
        }
      });
    }
  );
});
