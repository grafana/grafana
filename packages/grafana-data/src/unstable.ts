/**
 * THESE APIS MUST NOT BE USED IN COMMUNITY PLUGINS.
 *
 * Unstable APIs are still in development and are subject to breaking changes
 * at any point, like feature flags but for APIS. They must only be used in
 * Grafana core and internal plugins where we can coordinate changes.
 *
 * Once mature, they will be moved to the main export, be available to plugins via the standard import path,
 * and be subject to the standard policies
 */

// This is a dummy export so typescript doesn't error importing an "empty module"
export { DEFAULT_LANGUAGE, LANGUAGES } from './utils/i18n';
