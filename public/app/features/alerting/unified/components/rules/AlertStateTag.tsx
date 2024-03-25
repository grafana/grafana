import React from 'react';

import { AlertState } from '@grafana/data';
import { Tag, Tooltip } from '@grafana/ui';
import { GrafanaAlertState, GrafanaAlertStateWithReason, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
interface Props {
  state: PromAlertingRuleState | GrafanaAlertState | GrafanaAlertStateWithReason | AlertState;
  size?: 'md' | 'sm';
  isPaused?: boolean;
  muted?: boolean;
}

export const AlertStateTag = React.memo(({ state, isPaused = false, size = 'md', muted = false }: Props) => {
  if (isPaused) {
    return (
      <Tooltip content={'Alert evaluation is currently paused'} placement="top">
        <Tag icon="pause" name="Paused" colorIndex={1} />
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
