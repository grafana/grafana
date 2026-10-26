import { type ComponentProps } from 'react';

import {
  type AlertRuleAlertRuleHealth,
  type AlertRuleAlertRuleState,
  type RecordingRuleRecordingRuleHealth,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Icon, type IconName, Text, Tooltip } from '@grafana/ui';

type RuleStatusIconProps =
  | { kind: 'alert'; state?: AlertRuleAlertRuleState; health?: AlertRuleAlertRuleHealth; paused?: boolean }
  | { kind: 'recording'; health?: RecordingRuleRecordingRuleHealth; paused?: boolean };

/**
 * The status icon of the new list. It keeps the old list's colours and tooltips but gives firing, pending and paused
 * their own shapes, because their circles were confused at row size. The old list keeps StateIcon unchanged.
 */
export function RuleStatusIcon(props: RuleStatusIconProps) {
  const status = STATUSES[resolveStatusName(props)]();

  return (
    <Tooltip content={status.label} placement="right">
      <div>
        <Text color={status.color}>
          <Icon name={status.icon} width={ICON_SIZE} height={ICON_SIZE} aria-label={status.label} />
        </Text>
      </div>
    </Tooltip>
  );
}

const ICON_SIZE = 15;

interface Status {
  icon: IconName;
  color: ComponentProps<typeof Text>['color'];
  label: string;
}

function resolveStatusName(props: RuleStatusIconProps): StatusName {
  // The spec decides: status health stays Paused until the next sync after a resume.
  if (props.paused) {
    return 'paused';
  }
  if (props.health === 'Error') {
    return 'error';
  }
  if (props.health === 'NoData') {
    return 'no-data';
  }
  if (props.kind === 'recording') {
    return props.health === 'Recording' ? 'recording' : 'recording-unavailable';
  }
  // Health OK alone says nothing about whether the alert fires.
  return props.state ? ALERT_STATE_STATUS[props.state] : 'unavailable';
}

type StatusName = keyof typeof STATUSES;

// Labels are functions so they translate when shown, not when the module loads.
const STATUSES = {
  paused: () => ({ icon: 'pause', color: 'warning', label: t('alerting.gma-rule-list.status.paused', 'Paused') }),
  error: () => ({
    icon: 'times-circle',
    color: 'error',
    label: t('alerting.gma-rule-list.status.error', 'Failed to evaluate rule'),
  }),
  'no-data': () => ({
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
  'recording-unavailable': () => ({
    icon: 'square-shape',
    color: 'secondary',
    label: t('alerting.gma-rule-list.status.unavailable', 'Status unavailable'),
  }),
} satisfies Record<string, () => Status>;

// Keyed by the generated union, so a state the API adds fails the type check until it has an icon.
const ALERT_STATE_STATUS: Record<AlertRuleAlertRuleState, StatusName> = {
  Firing: 'firing',
  Pending: 'pending',
  Recovering: 'recovering',
  Healthy: 'normal',
  Inactive: 'normal',
};
