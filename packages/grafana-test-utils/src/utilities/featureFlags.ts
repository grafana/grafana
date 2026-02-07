import { InMemoryProvider, JsonValue, OpenFeature } from '@openfeature/react-sdk';

let ofProvider: InMemoryProvider;

// If changing this, you MUST also update the same constant in packages/grafana-runtime/src/internal/openFeature/constants.ts
const GRAFANA_CORE_OPEN_FEATURE_DOMAIN = 'internal-grafana-core';

function initTestOpenFeatureClient(): void {
  ofProvider ??= new InMemoryProvider();
  OpenFeature.setProvider(GRAFANA_CORE_OPEN_FEATURE_DOMAIN, ofProvider);
}

/**
 * Returns an OpenFeature client configured for use in tests. Not intended for general use im tests - prefer setting mock
 * flag values via `setTestFlags` instead.
 */
export function getTestFeatureFlagClient() {
  if (!ofProvider) {
    initTestOpenFeatureClient();
  }

  return OpenFeature.getClient(GRAFANA_CORE_OPEN_FEATURE_DOMAIN);
}

type FlagSet = Record<string, boolean | string | number | JsonValue>;

/**
 * Sets OpenFeature flag values for tests. Call it with an object of flag names and their values.
 * This modifies the global environment, so be sure to reset flags in `after` / `afterEach`.
 */
export function setTestFlags(flags: FlagSet = {}) {
  if (!ofProvider) {
    initTestOpenFeatureClient();
  }

  const flagConfig: Parameters<typeof ofProvider.putConfiguration>[0] = {};

  for (const [flagName, value] of Object.entries(flags)) {
    flagConfig[flagName] = {
      variants: {
        testedVariant: value,
      },
      defaultVariant: 'testedVariant',
      disabled: false,
    };
  }

  ofProvider.putConfiguration(flagConfig);
}
