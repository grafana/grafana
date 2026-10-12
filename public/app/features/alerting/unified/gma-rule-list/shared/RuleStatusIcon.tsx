import { StateIcon } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Icon, Text, Tooltip } from '@grafana/ui';

type AlertingState = 'normal' | 'firing' | 'pending' | 'recovering';
type StateIconHealth = 'ok' | 'nodata' | 'error';

interface RuleStatusIconProps {
  kind: 'alert' | 'recording';
  /** Kubernetes alert state, e.g. `Firing`. Ignored for recording rules. */
  state?: string;
  /** Kubernetes health, e.g. `OK`, `Error`, `NoData`, `Recording`, `Paused`, `Unknown`. */
  health?: string;
  paused?: boolean;
}

const STATE_MAP: Record<string, AlertingState> = {
  firing: 'firing',
  pending: 'pending',
  recovering: 'recovering',
  healthy: 'normal',
  inactive: 'normal',
  normal: 'normal',
};

const HEALTH_MAP: Record<string, StateIconHealth> = {
  error: 'error',
  nodata: 'nodata',
  ok: 'ok',
  recording: 'ok',
};

/**
 * Maps the Kubernetes rule status fields onto `StateIcon`'s Prometheus-style values. Unknown or
 * absent status gets a neutral circle instead of StateIcon's default, whose tooltip says "unknown".
 */
export function RuleStatusIcon({ kind, state, health, paused }: RuleStatusIconProps) {
  const normalizedHealth = health?.toLowerCase();
  const normalizedState = state?.toLowerCase();
  const isPaused = Boolean(paused) || normalizedHealth === 'paused';
  const mappedHealth = normalizedHealth ? HEALTH_MAP[normalizedHealth] : undefined;
  const mappedState = normalizedState ? STATE_MAP[normalizedState] : undefined;

  // Alerts need a state or a failing health: health `ok` alone says nothing StateIcon can show for them.
  const hasStatus =
    isPaused ||
    (kind === 'recording'
      ? mappedHealth !== undefined
      : mappedState !== undefined || mappedHealth === 'error' || mappedHealth === 'nodata');

  if (!hasStatus) {
    return (
      <Tooltip content={t('alerting.gma-rule-list.shared.status-unavailable', 'Status unavailable')} placement="right">
        <div>
          <Text color="secondary">
            <Icon
              name="circle"
              width={15}
              height={15}
              aria-label={t('alerting.gma-rule-list.shared.status-unavailable', 'Status unavailable')}
            />
          </Text>
        </div>
      </Tooltip>
    );
  }

  if (kind === 'recording') {
    return <StateIcon type="recording" health={mappedHealth} isPaused={isPaused} />;
  }

  return <StateIcon state={mappedState} health={mappedHealth} isPaused={isPaused} />;
}
