import { ReplaySubject } from 'rxjs';

import { PanelData, TimeRange, useObservable } from '@grafana/data';

export abstract class SceneItemBase<TState> implements SceneItem<TState> {
  subject = new ReplaySubject<TState>();
  state: TState;
  parent?: SceneItemBase<any>;

  constructor(state: TState) {
    this.state = state;
    this.subject.next(state);
    this.setParents();
  }

  private setParents() {
    for (const propValue of Object.values(this.state)) {
      if (propValue instanceof SceneItemBase) {
        propValue.parent = this;
      }
    }

    const children = (this.state as any).children as Array<SceneItemBase<any>>;
    if (children) {
      for (const child of children) {
        child.parent = this;
      }
    }
  }

  setState(state: Partial<TState>) {
    this.state = {
      ...this.state,
      ...state,
    };
    this.setParents();
    this.subject.next(this.state);
  }

  abstract Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.subject, this.state);
  }

  useData(): SceneDataState | null {
    const context = (this.state as SceneItemStateWithContext).context;
    if (context && context.data) {
      return context.data!.useState();
    }

    if (this.parent) {
      return this.parent.useData();
    }

    return null;
  }

  getTimeRange(): SceneItem<SceneTimeRangeState> | null {
    const context = (this.state as SceneItemStateWithContext).context;
    if (context && context.timeRange) {
      return context.timeRange;
    }

    if (this.parent) {
      return this.parent.getTimeRange();
    }

    return null;
  }
}

export interface SceneItem<TState> {
  state: TState;

  Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;
  useState(): TState;
  setState(state: TState): void;
}

export interface SceneContextState {
  timeRange?: SceneItem<SceneTimeRangeState>;
  data?: SceneItem<SceneDataState>;
}

export interface SceneItemStateWithContext {
  context?: SceneContextState;
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
