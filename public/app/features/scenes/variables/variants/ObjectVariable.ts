import { property } from 'lodash';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState, VariableValue } from '../types';

export interface ObjectVariableState<T extends object> extends SceneVariableState {
  value: T;
}

export class ObjectVariable<T extends object>
  extends SceneObjectBase<ObjectVariableState<T>>
  implements SceneVariable<ObjectVariableState<T>>
{
  private static fieldAccessorCache: FieldAccessorCache = {};

  public getValue(fieldPath: string): VariableValue {
    return this.getFieldAccessor(fieldPath)(this.state.value);
  }

  private getFieldAccessor(fieldPath: string) {
    const accessor = ObjectVariable.fieldAccessorCache[fieldPath];
    if (accessor) {
      return accessor;
    }

    return (ObjectVariable.fieldAccessorCache[fieldPath] = property(fieldPath));
  }
}

interface FieldAccessorCache {
  [key: string]: (obj: any) => any;
}
