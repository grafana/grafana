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

  featureFlags.setTestFlags({ 'entrypoint.enabled': true });
  expect(unstableClient.getBooleanValue('entrypoint.enabled', false)).toBe(true);

  setTestFlags({ 'entrypoint.enabled': false });
  expect(featureFlagsClient.getBooleanValue('entrypoint.enabled', true)).toBe(false);

  featureFlags.setTestFlags({});
  expect(featureFlagsClient.getBooleanValue('entrypoint.enabled', true)).toBe(true);
  expect(unstableClient.getBooleanValue('entrypoint.enabled', true)).toBe(true);
});
