import { PanelData } from '@grafana/data';

import { SceneItemBase } from './SceneItem';
import { SceneItemState } from './types';

export interface SceneDataNodeState extends SceneItemState {
  data?: PanelData;
}

export class SceneDataNode extends SceneItemBase<SceneDataNodeState> {}
