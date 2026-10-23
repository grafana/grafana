/**
 * Export things here that you want to be available under @grafana/alerting/convert
 *
 * Everything for Grafana's Prometheus convert API, which imports Prometheus-compatible (Mimir, Cortex,
 * Prometheus) rule groups and Alertmanager configs as Grafana-managed resources. Functions, types and the
 * RTKQ client only; no components.
 */

// API client
export { convertAPI } from './convert/api/client';
export {
  type ConvertRulesOptions,
  type ConvertRulesFolderOptions,
  type ConvertAlertmanagerOptions,
} from './convert/api/headers';

// Types
export {
  type RulerRuleDTO,
  type RulerAlertingRuleDTO,
  type RulerRecordingRuleDTO,
  type RulerRuleGroupDTO,
  type RulerRulesConfigDTO,
  type RulerNotificationSettingsDTO,
  type ConvertPrometheusResponse,
  type ConvertAlertmanagerResponse,
  type AlertmanagerUserConfig,
} from './convert/api/types';

// Notification settings
export {
  type NotificationSettings,
  toRulerNotificationSettings,
  fromRulerNotificationSettings,
} from './convert/notificationSettings';
