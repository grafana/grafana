// @todo: replace barrel import path
import { PanelModel } from 'app/features/dashboard/state/index';
// @todo: replace barrel import path
import { StoreState } from 'app/types/index';

import { PanelState } from './reducers';

export function getPanelStateForModel(state: StoreState, model: PanelModel): PanelState | undefined {
  return state.panels[model.key];
}
