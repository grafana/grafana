import { type ComponentProps } from 'react';

import { type AlertRuleAlertRuleState } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { type IconName, type Text } from '@grafana/ui';

import { type AlertRuleSearchHit } from '../alert-rules/alertRuleSearchHit';
import { type RecordingRuleSearchHit } from '../recording-rules/recordingRuleSearchHit';

export interface RuleStatus {
  icon: IconName;
  color: ComponentProps<typeof Text>['color'];
  label: string;
}

export function getAlertRuleStatus({
  paused,
  health,
  state,
}: Pick<AlertRuleSearchHit, 'state' | 'health' | 'paused'>): RuleStatus {
  // A paused rule isn't evaluated, so its last health and state are stale. Health Paused itself lags behind a resume.
  if (paused) {
    return STATUS.paused();
  }
  if (health === 'Error') {
    return STATUS.error();
  }
  if (health === 'NoData') {
    return STATUS.noData();
  }
  // Health OK alone says nothing about whether the alert fires, so the state decides.
  if (state) {
    return ALERT_STATE_STATUS[state]();
  }
  return STATUS.unavailable();
}

export function getRecordingRuleStatus({
  paused,
  health,
}: Pick<RecordingRuleSearchHit, 'health' | 'paused'>): RuleStatus {
  if (paused) {
    return STATUS.paused();
  }
  if (health === 'Error') {
    return STATUS.error();
  }
  if (health === 'NoData') {
    return STATUS.noData();
  }
  if (health === 'Recording') {
    return STATUS.recording();
  }
  return STATUS.recordingUnavailable();
}

// Labels are functions so they translate when shown, not when the module loads.
const STATUS = {
  paused: () => ({ icon: 'pause', color: 'warning', label: t('alerting.gma-rule-list.status.paused', 'Paused') }),
  error: () => ({
    icon: 'times-circle',
    color: 'error',
    label: t('alerting.gma-rule-list.status.error', 'Failed to evaluate rule'),
  }),
  noData: () => ({
    icon: 'exclamation-triangle',
    color: 'warning',
    label: t('alerting.gma-rule-list.status.no-data', 'Insufficient data'),
  }),
  recording: () => ({
    icon: 'square-shape',
    color: 'success',
    label: t('alerting.gma-rule-list.status.recording', 'Recording'),
  }),
  firing: () => ({ icon: 'fire', color: 'error', label: t('alerting.gma-rule-list.status.firing', 'Firing') }),
  pending: () => ({
    icon: 'hourglass',
    color: 'warning',
    label: t('alerting.gma-rule-list.status.pending', 'Pending'),
  }),
  recovering: () => ({
    icon: 'exclamation-circle',
    color: 'warning',
    label: t('alerting.gma-rule-list.status.recovering', 'Recovering'),
  }),
  normal: () => ({
    icon: 'check-circle',
    color: 'success',
    label: t('alerting.gma-rule-list.status.normal', 'Normal'),
  }),
  unavailable: () => ({
    icon: 'circle',
    color: 'secondary',
    label: t('alerting.gma-rule-list.status.unavailable', 'Status unavailable'),
  }),
  recordingUnavailable: () => ({
    icon: 'square-shape',
    color: 'secondary',
    label: t('alerting.gma-rule-list.status.unavailable', 'Status unavailable'),
  }),
} satisfies Record<string, () => RuleStatus>;

// Keyed by the generated union, so a state the API adds fails the type check until it has an icon.
const ALERT_STATE_STATUS: Record<AlertRuleAlertRuleState, () => RuleStatus> = {
  Firing: STATUS.firing,
  Pending: STATUS.pending,
  Recovering: STATUS.recovering,
  Healthy: STATUS.normal,
  Inactive: STATUS.normal,
};
