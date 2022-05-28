import { Subscribable } from 'rxjs';

import { PanelData, TimeRange } from '@grafana/data';

export interface SceneLayoutState {
  children: Array<SceneItem<SceneLayoutItemChildState>>;
}

export interface SceneItemStateWithScope {
  $timeRange?: SceneItem<SceneTimeRangeState>;
  $data?: SceneItem<SceneDataState>;
}

export interface SceneLayoutItemChildState {
  key?: string;
  size?: SceneItemSizing;
}

export interface SceneItemSizing {
  width?: number | string;
  height?: number | string;
  x?: number;
  y?: number;
  hSizing?: 'fill' | 'fixed';
  vSizing?: 'fill' | 'fixed';
}

export interface SceneComponentProps<T> {
  model: T;
}

export interface SceneDataState {
  data?: PanelData;
}

export interface SceneTimeRangeState {
  timeRange: TimeRange;
}

export interface SceneItem<TState> extends Subscribable<TState> {
  state: TState;
  isMounted?: boolean;

  Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;
  useState(): TState;
  setState(state: TState): void;

  onMount(): void;
  onUnmount(): void;
}
