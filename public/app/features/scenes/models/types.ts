import React from 'react';
import { Subscribable } from 'rxjs';

import { PanelData, TimeRange } from '@grafana/data';

export interface SceneObjectState {
  key?: string;
  size?: SceneObjectSize;
  $timeRange?: SceneObject<SceneTimeRangeState>;
  $data?: SceneObject<SceneDataState>;
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

export interface SceneTimeRangeState extends SceneObjectState {
  timeRange: TimeRange;
}

export interface SceneObject<TState extends SceneObjectState = SceneObjectState> extends Subscribable<TState> {
  /** The current state */
  state: TState;

  /** True when there is a React component mounted for this Object */
  isMounted?: boolean;

  /** SceneObject parent */
  parent?: SceneObject;

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

  /** Returns a deep clone this object and all it's children */
  clone(state?: Partial<TState>): this;

  /** A React component to use for rendering the object */
  Component(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;
}

export type SceneObjectList<T = SceneObjectState> = Array<SceneObject<T>>;

export interface SceneLayoutState extends SceneObjectState {
  children: SceneObjectList;
}

export type SceneLayout<T extends SceneLayoutState = SceneLayoutState> = SceneObject<T>;
