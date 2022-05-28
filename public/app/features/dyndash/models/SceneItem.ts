import { cloneDeep } from 'lodash';
import { useEffect } from 'react';
import { Observer, ReplaySubject, Subscription } from 'rxjs';

import { AbsoluteTimeRange, toUtc, useObservable } from '@grafana/data';

import { SceneComponentProps, SceneItemStateWithScope, SceneTimeRangeState, SceneDataState, SceneItem } from './types';

export abstract class SceneItemBase<TState> implements SceneItem<TState> {
  subject = new ReplaySubject<TState>();
  state: TState;
  parent?: SceneItemBase<any>;
  subs = new Subscription();
  isMounted?: boolean;

  constructor(state: TState) {
    this.state = state;
    this.subject.next(state);
    this.setParent();
  }

  private setParent() {
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

  subscribe(observer: Partial<Observer<TState>>) {
    return this.subject.subscribe(observer);
  }

  setState(state: Partial<TState>) {
    this.state = {
      ...this.state,
      ...state,
    };
    this.setParent();
    this.subject.next(this.state);
  }

  abstract Component(props: SceneComponentProps<SceneItem<TState>>): React.ReactElement | null;

  onMount() {
    this.isMounted = true;

    const { $data } = this.state as SceneItemStateWithScope;
    if ($data && !$data.isMounted) {
      $data.onMount();
    }
  }

  onUnmount() {
    this.isMounted = false;

    const { $data } = this.state as SceneItemStateWithScope;
    if ($data && $data.isMounted) {
      $data.onUnmount();
    }

    this.subs.unsubscribe();
  }

  private registerOnMountEffect() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (!this.isMounted) {
        this.onMount();
      }
      return () => {
        if (this.isMounted) {
          this.onUnmount();
        }
      };
    }, []);
  }

  useState() {
    this.registerOnMountEffect();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.subject, this.state);
  }

  /**
   * Will walk up the scene object graph to the closest $timeRange scene object
   */
  getTimeRange(): SceneItem<SceneTimeRangeState> {
    const { $timeRange } = this.state as SceneItemStateWithScope;
    if ($timeRange) {
      return $timeRange;
    }

    if (this.parent) {
      return this.parent.getTimeRange();
    }

    throw new Error('No time range found in scene tree');
  }

  /**
   * Will walk up the scene object graph to the closest $data scene object
   */
  getData(): SceneItem<SceneDataState> {
    const { $data } = this.state as SceneItemStateWithScope;
    if ($data) {
      return $data;
    }

    if (this.parent) {
      return this.parent.getData();
    }

    throw new Error('No data found in scene tree');
  }

  onSetTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = this.getTimeRange();
    sceneTimeRange.setState({
      timeRange: {
        raw: {
          from: toUtc(timeRange.from),
          to: toUtc(timeRange.to),
        },
        from: toUtc(timeRange.from),
        to: toUtc(timeRange.to),
      },
    });
  };

  /**
   * Will create new SceneItem with shalled cloned state, but all child items of type
   */
  clone(): this {
    // const clonedState = { ...this.state };

    // for (const key in clonedState) {
    //   const propValue = clonedState[key];
    //   if (propValue instanceof SceneItemBase) {
    //     clonedState[key] = propValue.clone();
    //  }
    // }

    // const children = (this.state as any).children as Array<SceneItemBase<any>>;
    // if (children) {
    //   for (const child of children) {
    //     child.parent = this;
    //   }
    // }

    const clonedState = cloneDeep(this.state);
    return new (this.constructor as any)(clonedState);
  }
}
