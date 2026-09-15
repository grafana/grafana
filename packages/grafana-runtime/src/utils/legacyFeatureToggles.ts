import { AppEvents, type FeatureToggles } from '@grafana/data';

import { getAppEvents } from '../services/appEvents';

/**
 * Possible values of the `grafana.frontendLegacyFeatureToggleHandling` feature flag.
 *
 * - `off`: reads of the legacy `config.featureToggles` map are left untouched
 * - `log`: reads resolve normally, but each toggle is reported once
 * - `block`: reads resolve to undefined, and each toggle is reported once
 */
export type LegacyFeatureToggleMode = 'off' | 'log' | 'block';

export function getLegacyFeatureToggleMode(): LegacyFeatureToggleMode {
  const mode = window.__grafanaLegacyFeatureToggleMode;
  if (mode === 'log' || mode === 'block') {
    return mode;
  }

  return 'off';
}

/**
 * Returns a proxy over the legacy feature toggle map which, once per toggle accessed, logs a
 * warning and raises a warning alert — and in `block` mode resolves the read to undefined.
 */
export function reportOrBlockLegacyFeatureToggles(
  featureToggles: FeatureToggles,
  mode: Exclude<LegacyFeatureToggleMode, 'off'>
): FeatureToggles {
  const reportedFeatureToggles = new Set<string>();

  return new Proxy(featureToggles, {
    get(target, property, receiver) {
      if (typeof property !== 'string') {
        return Reflect.get(target, property, receiver);
      }

      // Reported once per toggle rather than once per read: there are hundreds of legacy reads.
      if (!reportedFeatureToggles.has(property)) {
        reportedFeatureToggles.add(property);

        // The stack makes the call site findable.
        const resolution = mode === 'block' ? 'and now resolves to undefined' : 'and will stop resolving';
        console.warn(
          `[Deprecation warning] Reading "${property}" from config.featureToggles is deprecated ${resolution}. Use OpenFeature instead, or remove the legacy toggle entirely.`,
          new Error().stack
        );

        // Reads that happen before the app event bus is wired up have nowhere to publish, and must
        // not throw from inside a get trap — the console warning above covers that case.
        try {
          getAppEvents().publish({
            type: AppEvents.alertWarning.name,
            payload: [
              `Legacy feature toggle read: "${property}"`,
              'Use OpenFeature instead, or remove the legacy toggle entirely.',
            ],
          });
        } catch {}
      }

      if (mode === 'block') {
        return undefined;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
