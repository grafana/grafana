import { SceneObjectBase } from './SceneObjectBase';
import { SceneTimeRange } from './SceneTimeRange';
import { SceneObjectState, StandardSceneObjectContext } from './types';

/**
 * A scene object that can provide data execution context
 */
export class SceneContextObject<TState extends SceneObjectState = {}> extends SceneObjectBase<TState> {
  ctx: StandardSceneObjectContext = {
    timeRange: new SceneTimeRange(),
    variables: [],
  };

  constructor(state: TState) {
    super(state);
    // TODO: Resolve state from persisted model
    // this.ctx = { timeRange: ..., variables: ... };
  }
}
