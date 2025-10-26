import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { StoreState } from 'app/types/store';

import { PanelState } from './reducers';

export function getPanelStateForModel(state: StoreState, model: PanelModel): PanelState | undefined {
  return state.panels[model.key];
}
