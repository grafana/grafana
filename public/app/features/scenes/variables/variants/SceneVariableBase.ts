import { Observable } from 'rxjs';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState, VariableGetOptionsArgs, VariableValueOption } from '../types';

export abstract class SceneVariableBase<T extends SceneVariableState = SceneVariableState>
  extends SceneObjectBase<T>
  implements SceneVariable<T>
{
  abstract getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;
}
