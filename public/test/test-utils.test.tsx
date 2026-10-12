import { config } from '@grafana/runtime';
import { getTestFeatureFlagClient } from '@grafana/test-utils/unstable';

import { testWithFeatureToggles } from './test-utils';

describe('testWithFeatureToggles', () => {
  describe('a single call', () => {
    testWithFeatureToggles({ enable: ['alertingListViewV2'], disable: ['alertingNavigationV2'] });

    it('sets the toggles on config, for components reading config.featureToggles', () => {
      expect(config.featureToggles.alertingListViewV2).toBe(true);
      expect(config.featureToggles.alertingNavigationV2).toBe(false);
    });

    it('sets the same flags through OpenFeature, for components reading the flag hooks', () => {
      const client = getTestFeatureFlagClient();
      expect(client.getBooleanValue('alertingListViewV2', false)).toBe(true);
      expect(client.getBooleanValue('alertingNavigationV2', true)).toBe(false);
    });
  });

  describe('several calls covering one test', () => {
    testWithFeatureToggles({ enable: ['alertingListViewV2'] });
    testWithFeatureToggles({ enable: ['alertingNavigationV2'] });

    // setTestFlags replaces the whole flag config, so a second call must not drop the first's flags.
    it('applies the flags from every call', () => {
      const client = getTestFeatureFlagClient();
      expect(client.getBooleanValue('alertingListViewV2', false)).toBe(true);
      expect(client.getBooleanValue('alertingNavigationV2', false)).toBe(true);
    });
  });

  describe('a test outside the scope of any call', () => {
    it('does not see flags set for another describe block', () => {
      const client = getTestFeatureFlagClient();
      expect(client.getBooleanValue('alertingListViewV2', false)).toBe(false);
      expect(config.featureToggles.alertingListViewV2).toBeUndefined();
    });
  });
});
