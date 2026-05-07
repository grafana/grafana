import { getOFREPWebProvider } from '../internal/openFeature';
import { createProxyProvider } from '../internal/openFeature/proxy';

/**
 * Create a new OpenFeature provider that proxies Grafana's own OFREP provider.
 *
 * Allows plugins to safely rely on the same OFREP evaluations as Grafana without sharing a mutable domain or provider instance.
 */
export function createGrafanaOFREPProvider() {
  return createProxyProvider(getOFREPWebProvider());
}
