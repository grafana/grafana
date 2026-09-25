import type { MeticulousPublicApi } from '@alwaysmeticulous/sdk-bundles-api';
import {
  FlagNotFoundError,
  type Hook,
  type JsonValue,
  MultiProvider,
  type Provider,
  type ResolutionDetails,
  StandardResolutionReasons,
} from '@openfeature/web-sdk';

type MeticulousFlagContext = Partial<Pick<MeticulousPublicApi['context'], 'getFlagOverride' | 'recordFeatureFlag'>>;

declare global {
  interface Window {
    Meticulous?: { context?: MeticulousFlagContext };
  }
}

class MeticulousOverrideProvider implements Provider {
  readonly runsOn = 'client';
  readonly metadata = { name: 'Meticulous overrides' };

  resolveBooleanEvaluation(flagKey: string): ResolutionDetails<boolean> {
    return this.resolveOverride(flagKey, 'boolean');
  }

  resolveStringEvaluation(flagKey: string): ResolutionDetails<string> {
    return this.resolveOverride(flagKey, 'string');
  }

  resolveNumberEvaluation(): ResolutionDetails<number> {
    throw new FlagNotFoundError();
  }

  resolveObjectEvaluation<T extends JsonValue>(): ResolutionDetails<T> {
    throw new FlagNotFoundError();
  }

  private resolveOverride(flagKey: string, type: 'boolean'): ResolutionDetails<boolean>;
  private resolveOverride(flagKey: string, type: 'string'): ResolutionDetails<string>;
  private resolveOverride(flagKey: string, type: 'boolean' | 'string'): ResolutionDetails<boolean | string> {
    try {
      const override = window.Meticulous?.context?.getFlagOverride?.(flagKey);
      if (override?.overridden === true) {
        if (typeof override.value === type) {
          return { value: override.value, reason: StandardResolutionReasons.STATIC };
        }
        console.warn(`Ignoring Meticulous override for "${flagKey}": expected ${type}`);
      }
    } catch (error) {
      console.warn(`Failed to read Meticulous override for "${flagKey}"`, error);
    }

    throw new FlagNotFoundError();
  }
}

const reportingHook: Hook = {
  finally(_context, details) {
    if (typeof details.value !== 'boolean' && typeof details.value !== 'string') {
      return;
    }

    try {
      window.Meticulous?.context?.recordFeatureFlag?.(details.flagKey, details.value);
    } catch (error) {
      console.warn(`Failed to report Meticulous feature flag "${details.flagKey}"`, error);
    }
  },
};

class MeticulousProvider extends MultiProvider {
  override get hooks(): Hook[] {
    // Report the final resolution, not intermediate misses or values from individual providers.
    return [...super.hooks, reportingHook];
  }
}

export function createMeticulousProvider(providers: Provider[]): MultiProvider {
  return new MeticulousProvider([
    { provider: new MeticulousOverrideProvider() },
    ...providers.map((provider) => ({ provider })),
  ]);
}
