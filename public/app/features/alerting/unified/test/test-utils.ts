import { act } from '@testing-library/react';

import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions } from '../mocks';
import { setFolderAccessControl } from '../mocks/server/configure';

/**
 * Flushes out microtasks so we don't get warnings from `@floating-ui/react`
 * as per https://floating-ui.com/docs/react#testing
 */
export const flushMicrotasks = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/**
 * Enables feature toggles `beforeEach` test, and sets back to original settings `afterEach` test
 */
export const testWithFeatureToggles = (featureToggles: Array<keyof FeatureToggles>) => {
  const originalToggles = { ...config.featureToggles };

  beforeEach(() => {
    featureToggles.forEach((featureToggle) => {
      config.featureToggles[featureToggle] = true;
    });
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
  });
};

/**
 * Enables license features `beforeEach` test, and sets back to original settings `afterEach` test
 */
export const testWithLicenseFeatures = (features: string[]) => {
  const originalFeatures = { ...config.licenseInfo.enabledFeatures };
  beforeEach(() => {
    config.licenseInfo.enabledFeatures = config.licenseInfo.enabledFeatures || {};

    features.forEach((feature) => {
      config.licenseInfo.enabledFeatures[feature] = true;
    });
  });

  afterEach(() => {
    config.licenseInfo.enabledFeatures = originalFeatures;
  });
};

/**
 * "Grants" permissions via contextSrv mock, and additionally sets folder access control
 * API response to match
 */
export const grantPermissionsHelper = (permissions: AccessControlAction[]) => {
  const permissionsHash = permissions.reduce((hash, permission) => ({ ...hash, [permission]: true }), {});
  grantUserPermissions(permissions);
  setFolderAccessControl(permissionsHash);
};
