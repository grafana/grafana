/**
 * Export things here that you want to be available under @grafana/alerting
 *
 * ⚠️ This implies everything in here is public API and should be considered stable and treated as such – make sure to
 * think carefully about what you export here and the interfaces / data structures.
 *
 * Breaking changes should be avoided to maintain backwards compatibility for consumers of this package.
 */

export { AlertLabels } from './grafana/rules/components/labels/AlertLabels';
export { AlertLabel } from './grafana/rules/components/labels/AlertLabel';
// keep label utils internal to the app for now

// Utilities
export { base64UrlEncode } from './grafana/api/util';

// This is a dummy export so typescript doesn't error importing an "empty module"
export const index = {};
