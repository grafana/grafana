import { PanelData } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectStatePlain } from './types';

export interface SceneDataNodeState extends SceneObjectStatePlain {
  data?: PanelData;
}

export class SceneDataNode extends SceneObjectBase<SceneDataNodeState> {}
