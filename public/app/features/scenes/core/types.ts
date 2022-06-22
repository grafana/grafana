import React from 'react';
import { Subscribable } from 'rxjs';

import { EventBus, PanelData, TimeRange } from '@grafana/data';

import { SceneVariableSet } from '../variables/types';

export interface SceneObjectState {
  key?: string;
  size?: SceneObjectSize;
  $timeRange?: SceneTimeRange;
  $data?: SceneObject<SceneDataState>;
  $editor?: SceneEditor;
  $variables?: SceneVariableSet;
}

export interface SceneObjectSize {
  width?: number | string;
  height?: number | string;
  xSizing?: 'fill' | 'content';
  ySizing?: 'fill' | 'content';
  x?: number;
  y?: number;
  minWidth?: number | string;
  minHeight?: number | string;
}

export interface SceneComponentProps<T> {
  model: T;
  isEditing?: boolean;
}

export type SceneComponent<TModel> = React.FunctionComponent<SceneComponentProps<TModel>>;

export interface SceneDataState extends SceneObjectState {
  data?: PanelData;
}

export interface SceneObject<TState extends SceneObjectState = SceneObjectState> extends Subscribable<TState> {
  /** The current state */
  state: TState;

  /** True when there is a React component mounted for this Object */
  isMounted?: boolean;

  /** SceneObject parent */
  parent?: SceneObject;

  /** For only only used by from root to broadcast events */
  events: EventBus;

  /** Utility hook that wraps useObservable. Used by React components to subscribes to state changes */
  useState(): TState;

  /** How to modify state */
  setState(state: Partial<TState>): void;

  /** Utility hook for main component so that object knows when it's mounted */
  useMount(): this;

  /** Called when component mounts. A place to register event listeners add subscribe to state changes */
  onMount(): void;

  /** Called when component unmounts. Unsubscribe to events */
  onUnmount(): void;

  /** Get the scene editor */
  getSceneEditor(): SceneEditor;

  /** Returns a deep clone this object and all it's children */
  clone(state?: Partial<TState>): this;

  /** A React component to use for rendering the object */
  Component(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;

  /** To be replaced by declarative method */
  Editor(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;
}

export type SceneObjectList<T = SceneObjectState> = Array<SceneObject<T>>;

export interface SceneLayoutState extends SceneObjectState {
  children: SceneObjectList;
}

export type SceneLayout<T extends SceneLayoutState = SceneLayoutState> = SceneObject<T>;

export interface SceneEditorState extends SceneObjectState {
  hoverObject?: SceneObjectRef;
  selectedObject?: SceneObjectRef;
}

export interface SceneEditor extends SceneObject<SceneEditorState> {
  onMouseEnterObject(model: SceneObject): void;
  onMouseLeaveObject(model: SceneObject): void;
  onSelectObject(model: SceneObject): void;
}

export interface SceneTimeRangeState extends SceneObjectState, TimeRange {}
export interface SceneTimeRange extends SceneObject<SceneTimeRangeState> {
  onTimeRangeChange(timeRange: TimeRange): void;
  onIntervalChanged(interval: string): void;
  onRefresh(): void;
}

export interface SceneObjectRef {
  ref: SceneObject;
}

export function isSceneObject(obj: any): obj is SceneObject {
  return obj.useState !== undefined;
}

/** These functions are still just temporary until this get's refined */
export interface SceneObjectWithUrlSync extends SceneObject {
  getUrlState(): any;
}

export function isSceneObjectWithUrlSync(obj: any): obj is SceneObjectWithUrlSync {
  return obj.getUrlState !== undefined;
}
