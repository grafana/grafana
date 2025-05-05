import { memo } from 'react';

import { AlertState } from '@grafana/data';
import { Icon, Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { GrafanaAlertState, GrafanaAlertStateWithReason, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { Trans } from '../../../../../core/internationalization';
import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
interface Props {
  state: PromAlertingRuleState | GrafanaAlertState | GrafanaAlertStateWithReason | AlertState;
  size?: 'md' | 'sm';
  isPaused?: boolean;
  muted?: boolean;
}

export const AlertStateTag = memo(({ state, isPaused = false, size = 'md', muted = false }: Props) => {
  if (isPaused) {
    return (
      <Tooltip
        content={t(
          'alerting.alert-state-tag.content-alert-evaluation-is-currently-paused',
          'Alert evaluation is currently paused'
        )}
        placement="top"
      >
        <StateTag state="warning" size={size} muted={muted}>
          <Icon name="pause" size="xs" /> <Trans i18nKey="alerting.alert-state-tag.paused">Paused</Trans>
        </StateTag>
      </Tooltip>
    );
  }
  return (
    <StateTag state={alertStateToState(state)} size={size} muted={muted}>
      {alertStateToReadable(state)}
    </StateTag>
  );
});
AlertStateTag.displayName = 'AlertStateTag';
