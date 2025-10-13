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

// Dummy export to make it a valid module. Remove when we have real exports.
export const unstable = {};
