import { reportInteraction } from '@grafana/runtime';

export function trackNotificationPolicyCreated(payload: { hasCustomTimings: boolean; hasCustomGrouping: boolean }) {
  reportInteraction('grafana_alerting_notification_policy_created', payload);
}

export function trackNotificationPolicyCreateError(payload: { error: string }) {
  reportInteraction('grafana_alerting_notification_policy_create_error', payload);
}

export function trackNotificationPolicyDeleted() {
  reportInteraction('grafana_alerting_notification_policy_deleted');
}

export function trackNotificationPolicyDeleteError(payload: { error: string }) {
  reportInteraction('grafana_alerting_notification_policy_delete_error', payload);
}

export function trackNotificationPolicyReset() {
  reportInteraction('grafana_alerting_notification_policy_reset');
}

export function trackNotificationPolicyResetError(payload: { error: string }) {
  reportInteraction('grafana_alerting_notification_policy_reset_error', payload);
}

export function trackNotificationPolicyExported(payload: { isDefaultPolicy: boolean }) {
  reportInteraction('grafana_alerting_notification_policy_exported', payload);
}

export function trackNotificationPolicySelectorChanged(payload: { fromDefault: boolean; toDefault: boolean }) {
  reportInteraction('grafana_alerting_notification_policy_selector_changed', payload);
}

export function trackNotificationPoliciesToggledAll(payload: {
  action: 'expand' | 'collapse';
  visiblePoliciesCount: number;
}) {
  reportInteraction('grafana_alerting_notification_policies_toggle_all', payload);
}

export function trackNotificationPoliciesFilterContactPoint() {
  reportInteraction('grafana_alerting_notification_policies_filter_contact_point');
}

export function trackNotificationPoliciesFilterMatchers() {
  reportInteraction('grafana_alerting_notification_policies_filter_matchers');
}

export function trackNotificationPoliciesFilterPolicyTree(payload: { selectedCount: number }) {
  reportInteraction('grafana_alerting_notification_policies_filter_policy_tree', payload);
}
