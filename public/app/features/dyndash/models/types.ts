import { Subscribable } from 'rxjs';

import { PanelData, TimeRange } from '@grafana/data';

export interface SceneItemState {
  key?: string;
  size?: SceneItemSizing;
  $timeRange?: SceneItem<SceneTimeRangeState>;
  $data?: SceneItem<SceneDataState>;
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

export interface SceneDataState extends SceneItemState {
  data?: PanelData;
}

export interface SceneTimeRangeState extends SceneItemState {
  timeRange: TimeRange;
}

export interface SceneItem<TState extends SceneItemState = SceneItemState> extends Subscribable<TState> {
  state: TState;
  isMounted?: boolean;

  Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;
  useState(): TState;
  setState(state: TState): void;

  onMount(): void;
  onUnmount(): void;
  clone(state?: Partial<TState>): this;
}

export type SceneItemList<T = SceneItemState> = Array<SceneItem<T>>;

export interface SceneLayoutState extends SceneItemState {
  children: SceneItemList;
}

export type SceneLayout<T extends SceneLayoutState = SceneLayoutState> = SceneItem<T>;
