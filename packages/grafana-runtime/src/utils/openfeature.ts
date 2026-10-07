import { getLocalStorageProvider, getOFREPWebProvider } from '../internal/openFeature';
import { ProxyProvider } from '../internal/openFeature/proxy';

/**
 * Create a new OpenFeature provider that proxies Grafana's own OFREP provider.
 *
 * Allows plugins to safely rely on the same OFREP evaluations as Grafana without sharing a mutable domain or provider instance.
 *
 * Does not require a context to be provided to OpenFeature, as this is a read-only proxy to an already initialized provider.
 *
 * Should be used in combination after {@link createOpenFeatureLocalStorageProvider} for the standard multi-provider setup.
 *
 * @example
 * import { MultiProvider, OpenFeature } from "@openfeature/react-sdk";
 * // or from \@openfeature/web-sdk (react-sdk re-exports everything from web-sdk)
 *
 * import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from "@grafana/runtime";
 *
 * const OPEN_FEATURE_DOMAIN = "grafana-demo-plugin";
 * // or use `import pluginJson from "../plugin.json";` + `const OPEN_FEATURE_DOMAIN = pluginJson.id;`
 *
 * if (OpenFeature.getProvider(OPEN_FEATURE_DOMAIN) === OpenFeature.getProvider()) {
 *   OpenFeature.setProvider(
 *     OPEN_FEATURE_DOMAIN,
 *     new MultiProvider([
 *       { provider: createOpenFeatureLocalStorageProvider() },
 *       { provider: createOpenFeatureOFREPWebProvider() },
 *     ]),
 *   );
 * }
 */
export function createOpenFeatureOFREPWebProvider() {
  return new ProxyProvider(getOFREPWebProvider());
}

/**
 * Create a new OpenFeature provider that proxies Grafana's own localStorage provider.
 *
 * Allows plugins to safely rely on the same localStorage overrides as Grafana without sharing a mutable domain or provider instance.
 *
 * Does not require a context to be provided to OpenFeature, as this is a read-only proxy to an already initialized provider.
 *
 * Should be used in combination before {@link createOpenFeatureOFREPWebProvider} for the standard multi-provider setup.
 *
 * @example
 * import { MultiProvider, OpenFeature } from "@openfeature/react-sdk";
 * // or from \@openfeature/web-sdk (react-sdk re-exports everything from web-sdk)
 *
 * import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from "@grafana/runtime";
 *
 * const OPEN_FEATURE_DOMAIN = "grafana-demo-plugin";
 * // or use `import pluginJson from "../plugin.json";` + `const OPEN_FEATURE_DOMAIN = pluginJson.id;`
 *
 * if (OpenFeature.getProvider(OPEN_FEATURE_DOMAIN) === OpenFeature.getProvider()) {
 *   OpenFeature.setProvider(
 *     OPEN_FEATURE_DOMAIN,
 *     new MultiProvider([
 *       { provider: createOpenFeatureLocalStorageProvider() },
 *       { provider: createOpenFeatureOFREPWebProvider() },
 *     ]),
 *   );
 * }
 */
export function createOpenFeatureLocalStorageProvider() {
  return new ProxyProvider(getLocalStorageProvider());
}
