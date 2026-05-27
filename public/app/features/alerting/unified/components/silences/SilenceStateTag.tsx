import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { type State, StateTag } from '../StateTag';

const silenceStateToState: Record<SilenceState, State> = {
  [SilenceState.Active]: 'good',
  [SilenceState.Expired]: 'neutral',
  [SilenceState.Pending]: 'neutral',
};

interface Props {
  state: SilenceState;
}

export const SilenceStateTag = ({ state }: Props) => <StateTag state={silenceStateToState[state]}>{state}</StateTag>;
