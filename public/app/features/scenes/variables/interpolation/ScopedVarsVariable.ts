import { property } from 'lodash';

import { ScopedVar } from '@grafana/data';

import { VariableValue } from '../types';

import { FormatVariable } from './formatRegistry';

export class ScopedVarsVariable implements FormatVariable {
  private static fieldAccessorCache: FieldAccessorCache = {};

  public state: { name: string; value: ScopedVar };

  public constructor(name: string, value: ScopedVar) {
    this.state = { name, value };
  }

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
    const accessor = ScopedVarsVariable.fieldAccessorCache[fieldPath];
    if (accessor) {
      return accessor;
    }

    return (ScopedVarsVariable.fieldAccessorCache[fieldPath] = property(fieldPath));
  }
}

interface FieldAccessorCache {
  [key: string]: (obj: unknown) => unknown;
}

let scopedVarsVariable: ScopedVarsVariable | undefined;

/**
 * Reuses a single instance to avoid unnecessary memory allocations
 */
export function getSceneVariableForScopedVar(name: string, value: ScopedVar) {
  if (!scopedVarsVariable) {
    scopedVarsVariable = new ScopedVarsVariable(name, value);
  } else {
    scopedVarsVariable.state.name = name;
    scopedVarsVariable.state.value = value;
  }

  return scopedVarsVariable;
}
