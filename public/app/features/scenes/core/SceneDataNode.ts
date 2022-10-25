import { getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectStatePlain } from './types';

export interface SceneDataNodeState extends SceneObjectStatePlain {
  data?: PanelData;
}

export class SceneDataNode extends SceneObjectBase<SceneDataNodeState> {}

export const EmptyDataNode = new SceneDataNode({
  data: {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  },
});
