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

const MIGRATION_GUIDANCE = 'Use OpenFeature instead, or remove the legacy toggle entirely.';

function legacyFeatureToggleAlert(property: string, blocking: boolean) {
  if (blocking) {
    return {
      type: AppEvents.alertError.name,
      payload: [
        `Legacy feature toggle blocked: "${property}"`,
        `The read was blocked and resolved to undefined. ${MIGRATION_GUIDANCE}`,
      ],
    };
  }

  return {
    type: AppEvents.alertWarning.name,
    payload: [`Legacy feature toggle read: "${property}"`, MIGRATION_GUIDANCE],
  };
}

/**
 * Returns a proxy over the legacy feature toggle map which, once per toggle accessed, logs a
 * warning and raises an alert — a warning in `log` mode, and an error in `block` mode, where the
 * read also resolves to undefined.
 */
export function reportOrBlockLegacyFeatureToggles(
  featureToggles: FeatureToggles,
  mode: Exclude<LegacyFeatureToggleMode, 'off'>
): FeatureToggles {
  const reportedFeatureToggles = new Set<string>();
  const blocking = mode === 'block';

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
        try {
          getAppEvents().publish(legacyFeatureToggleAlert(property, blocking));
        } catch {}
      }

      if (blocking) {
        return undefined;
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
