import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { State, StateTag } from '../StateTag';

const silenceStateToState: Record<SilenceState, State> = {
  [SilenceState.Active]: 'good',
  [SilenceState.Expired]: 'neutral',
  [SilenceState.Pending]: 'neutral',
};

interface Props {
  state: SilenceState;
}

export const SilenceStateTag: FC<Props> = ({ state }) => (
  <StateTag state={silenceStateToState[state]}>{state}</StateTag>
);
