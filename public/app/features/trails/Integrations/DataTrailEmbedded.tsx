import { AdHocVariableFilter } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRange,
  SceneTimeRangeState,
} from '@grafana/scenes';

import { DataTrail } from '../DataTrail';

export interface DataTrailEmbeddedState extends SceneObjectState {
  timeRangeState: SceneTimeRangeState;
  metric?: string;
  filters?: AdHocVariableFilter[];
  dataSourceUid?: string;
}

export class DataTrailEmbedded extends SceneObjectBase<DataTrailEmbeddedState> {
  static Component = DataTrailEmbeddedRenderer;

  public trail: DataTrail;

  constructor(state: DataTrailEmbeddedState) {
    super(state);
    this.trail = buildDataTrailFromState(state);
  }
}

function DataTrailEmbeddedRenderer({ model }: SceneComponentProps<DataTrailEmbedded>) {
  return <model.trail.Component model={model.trail} />;
}

function buildDataTrailFromState({ metric, filters, dataSourceUid, timeRangeState }: DataTrailEmbeddedState) {
  return new DataTrail({
    $timeRange: new SceneTimeRange(timeRangeState),
    metric,
    initialDS: dataSourceUid,
    initialFilters: filters,
    embedded: true,
  });
}
