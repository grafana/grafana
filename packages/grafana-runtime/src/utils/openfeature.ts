import { getLocalStorageProvider, getOFREPWebProvider } from '../internal/openFeature';
import { ProxyProvider } from '../internal/openFeature/proxy';

/**
 * Create a new OpenFeature provider that proxies Grafana's own OFREP provider.
 *
 * Allows plugins to safely rely on the same OFREP evaluations as Grafana without sharing a mutable domain or provider instance.
 */
export function createOpenFeatureOFREPWebProvider() {
  return new ProxyProvider(getOFREPWebProvider());
}

/**
 * Create a new OpenFeature provider that proxies Grafana's own localStorage provider.
 *
 * Allows plugins to safely rely on the same localStorage overrides as Grafana without sharing a mutable domain or provider instance.
 */
export function createOpenFeatureLocalStorageProvider() {
  return new ProxyProvider(getLocalStorageProvider());
}
