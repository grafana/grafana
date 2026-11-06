import userEvent from '@testing-library/user-event';

import type { testWithFeatureToggles as TestWithFeatureToggles } from './helpers/testWithFeatureToggles';
import type { getWrapper as GetWrapper, render as AppRender } from './test-utils-renderer';

function getRenderer() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep Testing Library exports independent of the app graph without making render asynchronous.
  return require('./test-utils-renderer') as typeof import('./test-utils-renderer');
}

const customRender: typeof AppRender = (...args) => getRenderer().render(...args);
const getWrapper: typeof GetWrapper = (...args) => getRenderer().getWrapper(...args);

export const testWithFeatureToggles: typeof TestWithFeatureToggles = (options) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Only feature-toggle users need the runtime config dependency.
  const helpers = require('./helpers/testWithFeatureToggles') as typeof import('./helpers/testWithFeatureToggles');
  return helpers.testWithFeatureToggles(options);
};

/**
 * Enables license features `beforeEach` test, and sets back to empty object `afterEach` test
 */
export const testWithLicenseFeatures = ({ enable, disable }: { enable?: string[]; disable?: string[] }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Only license-feature users need the runtime config dependency.
  const { config } = require('@grafana/runtime') as typeof import('@grafana/runtime');

  beforeEach(() => {
    config.licenseInfo.enabledFeatures = config.licenseInfo.enabledFeatures || {};

    for (const feature of enable || []) {
      config.licenseInfo.enabledFeatures[feature] = true;
    }
    for (const feature of disable || []) {
      config.licenseInfo.enabledFeatures[feature] = false;
    }
  });

  afterEach(() => {
    config.licenseInfo.enabledFeatures = {};
  });
};

// Keep the real entry point eager so Testing Library installs its async wrapper and cleanup hooks at suite load.
export * from '@testing-library/react';
export { customRender as render, getWrapper, userEvent };
