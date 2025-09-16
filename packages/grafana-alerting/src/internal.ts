/**
 * Export things here that you want to be available under @grafana/alerting/internal
 */

export { INHERITABLE_KEYS, type InheritableProperties } from './grafana/notificationPolicies/utils';
export { AlertLabels, type AlertLabelsProps } from './grafana/rules/components/labels/AlertLabels';
export { AlertLabel, type AlertLabelProps } from './grafana/rules/components/labels/AlertLabel';
// keep label utils internal to the app for now

export default {};
