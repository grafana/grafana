import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { type StoreState } from 'app/types/store';

import { type PanelState } from './reducers';

export function getPanelStateForModel(state: StoreState, model: PanelModel): PanelState | undefined {
  return state.panels[model.key];
}
