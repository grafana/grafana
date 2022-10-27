import { SceneObjectBase } from '../core/SceneObjectBase';
//import { SceneVariableList } from './SceneVariableList';

import { SceneVariable, SceneVariableState } from './types';

export class SceneVariableBase<T extends SceneVariableState> extends SceneObjectBase<T> implements SceneVariable<T> {
  //   getParentList(): SceneVariableList {
  //     if (!this.parent || !(this.parent instanceof SceneVariableList)) {
  //       throw new Error('SceneVariable must have a parent of type SceneVariableList');
  //     }
  //     return this.parent;
  //   }
}
