import React, { FC } from 'react';

import { AlertState } from '@grafana/data';
import { GrafanaAlertStateWithReason, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertStateToReadable, alertStateToState } from '../../utils/rules';
import { StateTag } from '../StateTag';
interface Props {
  state: PromAlertingRuleState | GrafanaAlertStateWithReason | AlertState;
}

export const AlertStateTag: FC<Props> = ({ state }) => (
  <StateTag state={alertStateToState(state)}>{alertStateToReadable(state)}</StateTag>
);
