import { AppEvents, type FeatureToggles } from '@grafana/data';

import { getAppEvents } from '../services/appEvents';

/**
 * Possible values of the `grafana.frontendLegacyFeatureToggleHandling` feature flag.
 *
 * - `off`: reads of the legacy `config.featureToggles` map are left untouched
 * - `log`: reads resolve normally, and each toggle is warned about in the console once
 * - `alert`: as `log`, and each toggle also raises a warning alert once
 * - `block`: as `log`, and reads resolve to undefined
 */
export type LegacyFeatureToggleMode = 'off' | 'log' | 'alert' | 'block';

export function getLegacyFeatureToggleMode(): LegacyFeatureToggleMode {
  const mode = window.__grafanaLegacyFeatureToggleMode;
  if (mode === 'log' || mode === 'alert' || mode === 'block') {
    return mode;
  }

  return 'off';
}

const MIGRATION_GUIDANCE = 'Use OpenFeature instead, or remove the legacy toggle entirely.';

function legacyFeatureToggleAlert(property: string) {
  return {
    type: AppEvents.alertWarning.name,
    payload: [`Legacy feature toggle read: "${property}"`, MIGRATION_GUIDANCE],
  };
}

/**
 * Returns a proxy over the legacy feature toggle map which, once per toggle accessed, logs a
 * console warning. `alert` mode also raises a warning alert, and `block` mode resolves the read to
 * undefined. Blocking deliberately stays console-only: it breaks enough at once that a toast per
 * toggle would bury the app.
 */
export function reportOrBlockLegacyFeatureToggles(
  featureToggles: FeatureToggles,
  mode: Exclude<LegacyFeatureToggleMode, 'off'>
): FeatureToggles {
  const reportedFeatureToggles = new Set<string>();
  const blocking = mode === 'block';
  const alerting = mode === 'alert';

  return new Proxy(featureToggles, {
    get(target, property, receiver) {
      if (typeof property !== 'string') {
        return Reflect.get(target, property, receiver);
      }

      // Reported once per toggle rather than once per read: there are hundreds of legacy reads.
      if (!reportedFeatureToggles.has(property)) {
        reportedFeatureToggles.add(property);

        // The stack makes the call site findable.
        const resolution = blocking ? 'and now resolves to undefined' : 'and will stop resolving';
        console.warn(
          `[Deprecation warning] Reading "${property}" from config.featureToggles is deprecated ${resolution}. ${MIGRATION_GUIDANCE}`,
          new Error().stack
        );

        // Reads that happen before the app event bus is wired up have nowhere to publish, and must
        // not throw from inside a get trap — the console warning above covers that case.
        if (alerting) {
          try {
            getAppEvents().publish(legacyFeatureToggleAlert(property));
          } catch {}
        }
      }

      if (blocking) {
        return undefined;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
