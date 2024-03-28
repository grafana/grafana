import { AdHocVariableFilter } from '@grafana/data';
import { SceneObject, SceneObjectState, SceneTimeRangeLike } from '@grafana/scenes';

export interface DataTrailEmbeddedState extends SceneObjectState {
  timeRange: SceneTimeRangeLike;
  metric?: string;
  filters?: AdHocVariableFilter[];
  dataSourceUid?: string;
}

type SceneClass<TState extends SceneObjectState> = new (state: TState) => SceneObject<TState>;

// Note, this is similar to `DataTrailDrawer`

export let DataTrailEmbedded: SceneClass<DataTrailEmbeddedState>;
/**
 *
 * @internal
 */
export function setDataTrailEmbedded(ref: typeof DataTrailEmbedded) {
  DataTrailEmbedded = ref;
}
