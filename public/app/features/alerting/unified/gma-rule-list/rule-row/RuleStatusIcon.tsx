import { type ComponentProps } from 'react';

import { t } from '@grafana/i18n';
import { Icon, type IconName, Text, Tooltip } from '@grafana/ui';

interface RuleStatusIconProps {
  kind: 'alert' | 'recording';
  /** Ignored for recording rules. */
  state?: string;
  health?: string;
  paused?: boolean;
}

/**
 * The status icon of the new list. It keeps the old list's colours and tooltips but gives firing, pending and paused
 * their own shapes, because their circles were confused at row size. The old list keeps StateIcon unchanged.
 */
export function RuleStatusIcon({ kind, state, health, paused }: RuleStatusIconProps) {
  const status = resolveStatus(kind, state?.toLowerCase(), health?.toLowerCase(), Boolean(paused));

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

function resolveStatus(kind: 'alert' | 'recording', state?: string, health?: string, paused = false): Status {
  // The spec decides: status health stays Paused until the next sync after a resume.
  if (paused) {
    return { icon: 'pause', color: 'warning', label: t('alerting.gma-rule-list.status.paused', 'Paused') };
  }
  if (health === 'error') {
    return {
      icon: 'times-circle',
      color: 'error',
      label: t('alerting.gma-rule-list.status.error', 'Failed to evaluate rule'),
    };
  }
  if (health === 'nodata') {
    return {
      icon: 'exclamation-triangle',
      color: 'warning',
      label: t('alerting.gma-rule-list.status.no-data', 'Insufficient data'),
    };
  }

  if (kind === 'recording') {
    if (health === 'ok' || health === 'recording') {
      return {
        icon: 'square-shape',
        color: 'success',
        label: t('alerting.gma-rule-list.status.recording', 'Recording'),
      };
    }
    return statusUnavailable();
  }

  switch (state) {
    case 'firing':
      return { icon: 'fire', color: 'error', label: t('alerting.gma-rule-list.status.firing', 'Firing') };
    case 'pending':
      return { icon: 'hourglass', color: 'warning', label: t('alerting.gma-rule-list.status.pending', 'Pending') };
    case 'recovering':
      return {
        icon: 'exclamation-circle',
        color: 'warning',
        label: t('alerting.gma-rule-list.status.recovering', 'Recovering'),
      };
    case 'healthy':
    case 'inactive':
    case 'normal':
      return { icon: 'check-circle', color: 'success', label: t('alerting.gma-rule-list.status.normal', 'Normal') };
    default:
      // Health OK alone says nothing about whether the alert fires.
      return statusUnavailable();
  }
}

function statusUnavailable(): Status {
  return {
    icon: 'circle',
    color: 'secondary',
    label: t('alerting.gma-rule-list.status.unavailable', 'Status unavailable'),
  };
}
