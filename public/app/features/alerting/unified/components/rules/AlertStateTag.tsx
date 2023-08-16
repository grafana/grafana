import React from 'react';

import { AlertState } from '@grafana/data';
import { GrafanaAlertState, GrafanaAlertStateWithReason, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
interface Props {
  state: PromAlertingRuleState | GrafanaAlertState | GrafanaAlertStateWithReason | AlertState;
  size?: 'md' | 'sm';
  isPaused?: boolean;
  muted?: boolean;
}

export const AlertStateTag = React.memo(({ state, isPaused = false, size = 'md', muted = false }: Props) => (
  <StateTag state={alertStateToState(state)} size={size} muted={muted}>
    {alertStateToReadable(state)} {isPaused ? ' (Paused)' : ''}
  </StateTag>
));
AlertStateTag.displayName = 'AlertStateTag';
