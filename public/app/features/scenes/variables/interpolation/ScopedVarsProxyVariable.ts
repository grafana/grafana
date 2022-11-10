import { property } from 'lodash';

import { ScopedVar } from '@grafana/data';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState, VariableValue } from '../types';

export interface ScopedVarsProxyVariableState extends SceneVariableState {
  value: ScopedVar;
}

export class ScopedVarsProxyVariable
  extends SceneObjectBase<ScopedVarsProxyVariableState>
  implements SceneVariable<ScopedVarsProxyVariableState>
{
  private static fieldAccessorCache: FieldAccessorCache = {};

  public getValue(fieldPath: string): VariableValue {
    let { value } = this.state;
    let realValue = value.value;

    if (fieldPath) {
      realValue = this.getFieldAccessor(fieldPath)(value.value);
    } else {
      realValue = value.value;
    }

    if (realValue === 'string' || realValue === 'number' || realValue === 'boolean') {
      return realValue;
    }

    return String(realValue);
  }

  public getValueText(): string {
    const { value } = this.state;

    if (value.text != null) {
      return String(value.text);
    }

    return String(value);
  }

  private getFieldAccessor(fieldPath: string) {
    const accessor = ScopedVarsProxyVariable.fieldAccessorCache[fieldPath];
    if (accessor) {
      return accessor;
    }

    return (ScopedVarsProxyVariable.fieldAccessorCache[fieldPath] = property(fieldPath));
  }
}

interface FieldAccessorCache {
  [key: string]: (obj: unknown) => unknown;
}

let variable: ScopedVarsProxyVariable | undefined;

/**
 * Reusing the same variable instance for memory reasons
 */
export function getVariableForScopedVar(value: ScopedVar): ScopedVarsProxyVariable {
  if (!variable) {
    variable = new ScopedVarsProxyVariable({ name: 'A', value });
  } else {
    variable.setState({ value });
  }

  return variable;
}
