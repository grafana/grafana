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
    enable?.forEach((featureToggle) => {
      config.featureToggles[featureToggle] = true;
    });
    disable?.forEach((featureToggle) => {
      config.featureToggles[featureToggle] = false;
    });
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

    enable?.forEach((feature) => {
      config.licenseInfo.enabledFeatures[feature] = true;
    });
    disable?.forEach((feature) => {
      config.licenseInfo.enabledFeatures[feature] = false;
    });
  });

  afterEach(() => {
    config.licenseInfo.enabledFeatures = originalFeatures;
  });
};
