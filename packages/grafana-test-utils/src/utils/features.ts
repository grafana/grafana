import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

/**
 * Enables and disables feature toggles `beforeEach` test, and sets back to original settings `afterEach` test
 */
export const testWithFeatureToggles = ({
  enable,
  disable,
}: {
  enable?: Array<keyof FeatureToggles>;
  disable?: Array<keyof FeatureToggles>;
}) => {
  const originalToggles = { ...config.featureToggles };

  beforeEach(() => {
    for (const featureToggle of enable || []) {
      config.featureToggles[featureToggle] = true;
    }
    for (const featureToggle of disable || []) {
      config.featureToggles[featureToggle] = false;
    }
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
  });
};

/**
 * Enables license features `beforeEach` test, and sets back to original settings `afterEach` test
 */
export const testWithLicenseFeatures = ({ enable, disable }: { enable?: string[]; disable?: string[] }) => {
  const originalFeatures = { ...config.licenseInfo.enabledFeatures };
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
    config.licenseInfo.enabledFeatures = originalFeatures;
  });
};
