import { AdHocVariableFilter } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneTimeRangeLike } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';

export interface DataTrailEmbeddedState extends SceneObjectState {
  timeRange: SceneTimeRangeLike;
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

function buildDataTrailFromState({ metric, filters, dataSourceUid, timeRange }: DataTrailEmbeddedState) {
  return new DataTrail({
    $timeRange: timeRange,
    metric,
    initialDS: dataSourceUid,
    initialFilters: filters,
    embedded: true,
  });
}
