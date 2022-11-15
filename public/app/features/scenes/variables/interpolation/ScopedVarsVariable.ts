import { property } from 'lodash';
import { ReactElement } from 'react';
import { Observable, Observer, Subscription, Unsubscribable } from 'rxjs';

import { BusEvent, BusEventHandler, BusEventType, ScopedVar } from '@grafana/data';

import {
  SceneObject,
  SceneObjectState,
  SceneEditor,
  SceneDataState,
  SceneTimeRange,
  SceneComponentProps,
  SceneLayoutState,
} from '../../core/types';
import {
  SceneVariable,
  SceneVariableDependencyConfigLike,
  SceneVariables,
  SceneVariableState,
  ValidateAndUpdateResult,
  VariableValue,
} from '../types';

export interface ScopedVarsProxyVariableState extends SceneVariableState {
  value: ScopedVar;
}

export class ScopedVarsVariable implements SceneVariable<ScopedVarsProxyVariableState> {
  public state: ScopedVarsProxyVariableState;
  private static fieldAccessorCache: FieldAccessorCache = {};

  public constructor(state: ScopedVarsProxyVariableState) {
    this.state = state;
  }

  public setState(state: Partial<ScopedVarsProxyVariableState>) {
    this.state = { ...this.state, ...state };
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

  /**
   * The SceneVariable interface. This class is a bit of fake Variable. Only used in the formatting of the value.
   * Playing the role of a variable so the formatting logic does not need special handling for scopedVars
   *
   * The reason we are implementing the SceneVariable interface here instead of extending SceneObjectBase is because of circular dependencies.
   * SceneObjectBase depends on sceneInterpolate which depends on this class.
   **/

  public validateAndUpdate?(): Observable<ValidateAndUpdateResult> {
    throw new Error('Method not implemented.');
  }

  public isActive = false;
  public parent?: SceneObject<SceneObjectState> | undefined;
  public variableDependency?: SceneVariableDependencyConfigLike | undefined;

  public subscribeToState(observer?: Partial<Observer<ScopedVarsProxyVariableState>> | undefined): Subscription {
    throw new Error('Method not implemented.');
  }

  public subscribeToEvent<T extends BusEvent>(
    typeFilter: BusEventType<T>,
    handler: BusEventHandler<T>
  ): Unsubscribable {
    throw new Error('Method not implemented.');
  }

  public publishEvent(event: BusEvent, bubble?: boolean | undefined): void {
    throw new Error('Method not implemented.');
  }

  public useState(): ScopedVarsProxyVariableState {
    throw new Error('Method not implemented.');
  }

  public activate(): void {
    throw new Error('Method not implemented.');
  }

  public deactivate(): void {
    throw new Error('Method not implemented.');
  }

  public getSceneEditor(): SceneEditor {
    throw new Error('Method not implemented.');
  }

  public getRoot(): SceneObject<SceneObjectState> {
    throw new Error('Method not implemented.');
  }

  public getData(): SceneObject<SceneDataState> {
    throw new Error('Method not implemented.');
  }

  public getVariables(): SceneVariables | undefined {
    throw new Error('Method not implemented.');
  }

  public getTimeRange(): SceneTimeRange {
    throw new Error('Method not implemented.');
  }

  public clone(state?: Partial<ScopedVarsProxyVariableState>): this {
    throw new Error('Method not implemented.');
  }

  public Component(props: SceneComponentProps<SceneObject<ScopedVarsProxyVariableState>>): ReactElement {
    throw new Error('Method not implemented.');
  }

  public Editor(props: SceneComponentProps<SceneObject<ScopedVarsProxyVariableState>>): ReactElement {
    throw new Error('Method not implemented.');
  }

  public getLayout(): SceneObject<SceneLayoutState> {
    throw new Error('Method not implemented.');
  }

  public forceRender(): void {
    throw new Error('Method not implemented.');
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
    scopedVarsVariable = new ScopedVarsVariable({ name, value });
  } else {
    scopedVarsVariable.setState({ name, value });
  }

  return scopedVarsVariable;
}
