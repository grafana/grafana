import { expect, test } from '@grafana/plugin-e2e';

const TRUTHY_CUSTOM_TOGGLE = 'custom_toggle1';
const FALSY_CUSTOM_TOGGLE = 'custom_toggle2';

// override the feature toggles defined in playwright.config.ts only for tests in this file
test.use({
  featureToggles: {
    [TRUTHY_CUSTOM_TOGGLE]: true,
    [FALSY_CUSTOM_TOGGLE]: false,
  },
});

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should set and check feature toggles correctly', async ({ isFeatureToggleEnabled }) => {
      expect(await isFeatureToggleEnabled(TRUTHY_CUSTOM_TOGGLE)).toBeTruthy();
      expect(await isFeatureToggleEnabled(FALSY_CUSTOM_TOGGLE)).toBeFalsy();
    });
  }
);
