import { DataQuery, EventBus, PanelData, TimeRange } from '@grafana/data';

import { SceneItemBase } from './SceneItem';
import { SceneTimeRange } from './SceneTimeRange';

export interface QueryRunnerState {
  data?: PanelData;
  queries: DataQuery[];
}

export interface SceneContext {
  bus: EventBus;
  getTimeRange(): TimeRange;
  getVariables(): Record<string, string>;
}

export interface QueryScope {
  timeRange: SceneTimeRange;
  events: EventBus;
}

export class SceneQueryRunner extends SceneItemBase<QueryRunnerState> {
  init() {}

  Component = () => null;
}
