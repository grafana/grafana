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
  x?: number;
  y?: number;
  hSizing?: 'fill' | 'fixed';
  vSizing?: 'fill' | 'fixed';
  minWidth?: number | string;
  minHeight?: number | string;
}

export interface SceneComponentProps<T> {
  model: T;
}

export interface SceneDataState extends SceneObjectState {
  data?: PanelData;
}

export interface SceneTimeRangeState extends SceneObjectState {
  timeRange: TimeRange;
}

export interface SceneObject<TState extends SceneObjectState = SceneObjectState> extends Subscribable<TState> {
  state: TState;
  isMounted?: boolean;
  parent?: SceneObject<any>;

  /** Utility hook that wraps useObservable. Used by React components to subscribes to state changes */
  useState(): TState;
  /** How to modify state */
  setState(state: Partial<TState>): void;
  /** Utility hook for main component so that object knows when it's mounted */
  useMount(): this;
  onMount(): void;
  onUnmount(): void;
  clone(state?: Partial<TState>): this;

  /** A React component to use for rendering the object */
  Component(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;
}

export type SceneObjectList<T = SceneObjectState> = Array<SceneObject<T>>;

export interface SceneLayoutState extends SceneObjectState {
  children: SceneObjectList;
}

export type SceneLayout<T extends SceneLayoutState = SceneLayoutState> = SceneObject<T>;
