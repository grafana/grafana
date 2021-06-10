import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import React, { FC } from 'react';
import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
interface Props {
  state: PromAlertingRuleState | GrafanaAlertState;
}

export const AlertStateTag: FC<Props> = ({ state }) => (
  <StateTag state={alertStateToState[state]}>{alertStateToReadable(state)}</StateTag>
);
