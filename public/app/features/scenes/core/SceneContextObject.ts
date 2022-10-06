import { SceneObjectBase } from './SceneObjectBase';
import { SceneTimeRange } from './SceneTimeRange';
import { SceneObjectStatePlain, StandardSceneObjectContext } from './types';

export interface SceneContextObjectState extends SceneObjectStatePlain {
  /** Indicates this object scope uses the enclosing context */
  inheritContext?: boolean;
}

/**
 * A scene object that can provide data execution context
 */
export class SceneContextObject<TState extends SceneContextObjectState = {}> extends SceneObjectBase<TState> {
  ctx: StandardSceneObjectContext = {
    timeRange: new SceneTimeRange(),
    variables: [],
  };

  constructor(state: TState) {
    super(state);
    // TODO: Resolve state from persisted model
    // this.ctx = { timeRange: ..., variables: ... };
  }

  getContext = () => {
    if (this.state.inheritContext && this.parent) {
      return this.parent.getContext();
    }

    return this.ctx;
  };
}
