import { type FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

/**
 * Enables and disables feature toggles `beforeEach` test, and sets back to empty object `afterEach` test.
 * Keep this helper separate from render utilities so scene-only tests do not load the application store.
 */
export const testWithFeatureToggles = ({
  enable,
  disable,
}: {
  enable?: Array<keyof FeatureToggles>;
  disable?: Array<keyof FeatureToggles>;
}) => {
  beforeEach(() => {
    for (const featureToggle of enable || []) {
      config.featureToggles[featureToggle] = true;
    }
    for (const featureToggle of disable || []) {
      config.featureToggles[featureToggle] = false;
    }
  });

  afterEach(() => {
    config.featureToggles = {};
  });
};
