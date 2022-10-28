import { SceneObjectBase } from '../core/SceneObjectBase';
//import { SceneVariableList } from './SceneVariableList';

import { SceneVariable, SceneVariableState } from './types';

export class SceneVariableBase<T extends SceneVariableState = SceneVariableState>
  extends SceneObjectBase<T>
  implements SceneVariable<T> {}
