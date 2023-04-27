import React from 'react';

import { AlertState } from 'app/plugins/datasource/alertmanager/types';

import { State, StateTag } from '../StateTag';

const alertStateToState: Record<AlertState, State> = {
  [AlertState.Active]: 'bad',
  [AlertState.Unprocessed]: 'neutral',
  [AlertState.Suppressed]: 'info',
};

interface Props {
  state: AlertState;
}

export const AmAlertStateTag = ({ state }: Props) => <StateTag state={alertStateToState[state]}>{state}</StateTag>;
