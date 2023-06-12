import { PanelModel } from 'app/features/dashboard/state';
import { StoreState } from 'app/types';

import { PanelState } from './reducers';

export function getPanelStateForModel(state: StoreState, model: PanelModel): PanelState | undefined {
  return state.panels[model.key];
}
