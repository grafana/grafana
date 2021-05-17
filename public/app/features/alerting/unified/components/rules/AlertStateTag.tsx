import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { FC } from 'react';
import { alertStateToReadable } from '../../utils/rules';
import { State, StateTag } from '../StateTag';

const alertStateToState: Record<PromAlertingRuleState | GrafanaAlertState, State> = {
  [PromAlertingRuleState.Inactive]: 'good',
  [PromAlertingRuleState.Firing]: 'bad',
  [PromAlertingRuleState.Pending]: 'warning',
  [GrafanaAlertState.Alerting]: 'bad',
  [GrafanaAlertState.Error]: 'bad',
  [GrafanaAlertState.NoData]: 'info',
  [GrafanaAlertState.Normal]: 'good',
  [GrafanaAlertState.Pending]: 'warning',
};

interface Props {
  state: PromAlertingRuleState | GrafanaAlertState;
}

export const AlertStateTag: FC<Props> = ({ state }) => (
  <StateTag state={alertStateToState[state]}>{alertStateToReadable(state)}</StateTag>
);
