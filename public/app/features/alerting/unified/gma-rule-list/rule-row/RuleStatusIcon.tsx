import { StateIcon } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Icon, Text, Tooltip } from '@grafana/ui';

type AlertingState = 'normal' | 'firing' | 'pending' | 'recovering';
type StateIconHealth = 'ok' | 'nodata' | 'error';

interface RuleStatusIconProps {
  kind: 'alert' | 'recording';
  /** Ignored for recording rules. */
  state?: string;
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

/** Unknown status gets a neutral circle, since StateIcon's default tooltip says "unknown". */
export function RuleStatusIcon({ kind, state, health, paused }: RuleStatusIconProps) {
  const normalizedHealth = health?.toLowerCase();
  const normalizedState = state?.toLowerCase();
  // The spec decides: status health stays Paused until the next sync after a resume.
  const isPaused = Boolean(paused);
  const mappedHealth = normalizedHealth ? HEALTH_MAP[normalizedHealth] : undefined;
  const mappedState = normalizedState ? STATE_MAP[normalizedState] : undefined;

  // Alerts need a state or a failing health: health `ok` alone leaves StateIcon showing "unknown".
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
    return <StateIcon type="recording" health={mappedHealth} isPaused={isPaused} distinctShapes />;
  }

  return <StateIcon state={mappedState} health={mappedHealth} isPaused={isPaused} distinctShapes />;
}
