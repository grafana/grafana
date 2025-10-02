import type {
  AlertRule,
  AlertRuleSpec,
  RecordingRule,
  RecordingRuleSpec,
} from 'app/api/clients/rules/v0alpha1/endpoints.gen';
import {
  GrafanaPromAlertingRuleDTO,
  GrafanaPromRecordingRuleDTO,
  PromAlertingRuleState,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

const FOLDER_ANNOTATION_KEY = 'grafana.app/folder';
const GROUP_LABEL_KEY = 'alerting.grafana.app/group';

/**
 * Converts a K8s AlertRule to GrafanaPromAlertingRuleDTO format
 */
export function convertK8sAlertRuleToDTO(rule: AlertRule): GrafanaPromAlertingRuleDTO {
  const spec = rule.spec as AlertRuleSpec;
  const metadata = rule.metadata;

  // Extract folder UID from annotations
  const folderUid = metadata?.annotations?.[FOLDER_ANNOTATION_KEY] || '';

  // Find the source expression (the one that will be evaluated)
  const sourceExpressionEntry = Object.entries(spec.expressions || {}).find(([, expr]) => expr.source === true);
  const query = sourceExpressionEntry ? JSON.stringify(sourceExpressionEntry[1].model) : '';

  // Convert to DTO format
  const dto: GrafanaPromAlertingRuleDTO = {
    uid: metadata?.name || '',
    folderUid,
    name: spec.title || '',
    query,
    labels: spec.labels ? Object.fromEntries(Object.entries(spec.labels)) : {},
    annotations: spec.annotations ? Object.fromEntries(Object.entries(spec.annotations)) : {},
    type: PromRuleType.Alerting,
    health: 'ok', // Default health status
    state: PromAlertingRuleState.Inactive, // Default state, would need to be enriched from status
    isPaused: spec.paused || false,
    duration: spec.for ? parseDurationToSeconds(spec.for) : undefined,
    evaluationTime: 0, // Would need to come from status
    lastEvaluation: '', // Would need to come from status
    totals: {
      alerting: 0,
      pending: 0,
      inactive: 0,
      nodata: 0,
      error: 0,
      recovering: 0,
    },
    totalsFiltered: {
      alerting: 0,
      pending: 0,
      inactive: 0,
      nodata: 0,
      error: 0,
      recovering: 0,
    },
    alerts: [],
    notificationSettings: spec.notificationSettings
      ? {
          receiver: spec.notificationSettings.receiver,
          group_by: spec.notificationSettings.groupBy,
          group_wait: spec.notificationSettings.groupWait as string | undefined,
          group_interval: spec.notificationSettings.groupInterval as string | undefined,
          repeat_interval: spec.notificationSettings.repeatInterval as string | undefined,
          mute_time_intervals: spec.notificationSettings.muteTimeIntervals as string[] | undefined,
          active_time_intervals: spec.notificationSettings.activeTimeIntervals as string[] | undefined,
        }
      : undefined,
  };

  return dto;
}

/**
 * Converts a K8s RecordingRule to GrafanaPromRecordingRuleDTO format
 */
export function convertK8sRecordingRuleToDTO(rule: RecordingRule): GrafanaPromRecordingRuleDTO {
  const spec = rule.spec as RecordingRuleSpec;
  const metadata = rule.metadata;

  // Extract folder UID from annotations
  const folderUid = metadata?.annotations?.[FOLDER_ANNOTATION_KEY] || '';

  // Find the source expression
  const sourceExpressionEntry = Object.entries(spec.expressions || {}).find(([, expr]) => expr.source === true);
  const query = sourceExpressionEntry ? JSON.stringify(sourceExpressionEntry[1].model) : '';

  const dto: GrafanaPromRecordingRuleDTO = {
    uid: metadata?.name || '',
    folderUid,
    name: spec.metric || spec.title || '',
    query,
    labels: spec.labels ? Object.fromEntries(Object.entries(spec.labels)) : {},
    type: PromRuleType.Recording,
    health: 'ok',
    isPaused: spec.paused || false,
    evaluationTime: 0,
    lastEvaluation: '',
  };

  return dto;
}

/**
 * Extracts group name from rule metadata
 */
export function extractGroupName(rule: AlertRule | RecordingRule): string {
  return rule.metadata?.labels?.[GROUP_LABEL_KEY] || 'default';
}

/**
 * Extracts folder UID from rule metadata
 */
export function extractFolderUid(rule: AlertRule | RecordingRule): string {
  return rule.metadata?.annotations?.[FOLDER_ANNOTATION_KEY] || '';
}

/**
 * Parse Prometheus duration string to seconds
 */
function parseDurationToSeconds(duration: string): number {
  // Parse duration strings like "1m", "5m", "1h", etc.
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 0;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 0;
  }
}
