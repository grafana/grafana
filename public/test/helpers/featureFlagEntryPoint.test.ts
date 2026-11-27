import * as featureFlags from '@grafana/test-utils/feature-flags';
import { getTestFeatureFlagClient, setTestFlags, testWithFlags } from '@grafana/test-utils/unstable';

afterEach(() => {
  featureFlags.setTestFlags({});
});

it('shares helper identities and flag state between the feature-flags and unstable entries', () => {
  expect(featureFlags.getTestFeatureFlagClient).toBe(getTestFeatureFlagClient);
  expect(featureFlags.setTestFlags).toBe(setTestFlags);
  expect(featureFlags.testWithFlags).toBe(testWithFlags);

  const featureFlagsClient = featureFlags.getTestFeatureFlagClient();
  const unstableClient = getTestFeatureFlagClient();

  featureFlags.setTestFlags({ panelTitleSearch: true });
  expect(unstableClient.getBooleanValue('panelTitleSearch', false)).toBe(true);

  setTestFlags({ panelTitleSearch: false });
  expect(featureFlagsClient.getBooleanValue('panelTitleSearch', true)).toBe(false);

  featureFlags.setTestFlags({});
  expect(featureFlagsClient.getBooleanValue('panelTitleSearch', true)).toBe(true);
  expect(unstableClient.getBooleanValue('panelTitleSearch', true)).toBe(true);
});
