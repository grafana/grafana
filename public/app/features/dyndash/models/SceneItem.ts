import { ReplaySubject } from 'rxjs';

import { useObservable } from '@grafana/data';

export abstract class SceneItem<TState> {
  subject = new ReplaySubject<TState>();
  state: TState;

  constructor(state: TState) {
    this.state = state;
    this.subject.next(state);
  }

  setState(state: Partial<TState>) {
    this.state = {
      ...this.state,
      ...state,
    };
    this.subject.next(this.state);
  }

  abstract Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.subject, this.state);
  }
}

export interface SceneLayoutItemChildState {
  key?: string;
  size: SceneItemSizing;
}

export interface SceneItemSizing {
  width?: number | string;
  height?: number | string;
  x?: number;
  y?: number;
  hSizing: 'fill' | 'fixed';
  vSizing: 'fill' | 'fixed';
}

export interface SceneComponentProps<T> {
  model: T;
}

export interface SceneLayoutState {
  children: Array<SceneItem<SceneLayoutItemChildState>>;
}
