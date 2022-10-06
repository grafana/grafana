import { useEffect } from 'react';
import { Observer, Subject, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { EventBusSrv } from '@grafana/data';
import { useForceUpdate } from '@grafana/ui';

import { SceneComponentWrapper } from './SceneComponentWrapper';
import { SceneObjectStateChangedEvent } from './events';
import {
  SceneObject,
  SceneComponent,
  SceneEditor,
  SceneTimeRange,
  isSceneObject,
  SceneObjectState,
  SceneLayoutChild,
  StandardSceneObjectContext,
  SceneDataState,
} from './types';

export abstract class SceneObjectBase<TState extends SceneObjectState = {}> implements SceneObject<TState> {
  // keeps keys of all scene objects that are referencing this object
  _refCounter = new Set<string>();
  subject = new Subject<TState>();
  state: TState;
  parent?: SceneObjectBase<SceneObjectState>;
  subs = new Subscription();
  isActive?: boolean;
  events = new EventBusSrv();

  constructor(state: TState) {
    if (!state.key) {
      state.key = uuidv4();
    }

    this.state = state;
    this.subject.next(state);
    this.setParent();
  }

  /**
   * Used in render functions when rendering a SceneObject.
   * Wraps the component in an EditWrapper that handles edit mode
   */
  get Component(): SceneComponent<this> {
    return SceneComponentWrapper;
  }

  /**
   * Temporary solution, should be replaced by declarative options
   */
  get Editor(): SceneComponent<this> {
    return ((this as any).constructor['Editor'] ?? (() => null)) as SceneComponent<this>;
  }

  private setParent() {
    for (const propValue of Object.values(this.state)) {
      if (isSceneObject(propValue)) {
        propValue.parent = this;
      }

      if (Array.isArray(propValue)) {
        for (const child of propValue) {
          if (isSceneObject(child)) {
            child.parent = this;
          }
        }
      }
    }
  }

  /** This function implements the Subscribable<TState> interface */
  subscribe(observer: Partial<Observer<TState>>) {
    return this.subject.subscribe(observer);
  }

  setState(update: Partial<TState>) {
    const prevState = this.state;
    this.state = {
      ...this.state,
      ...update,
    };
    this.setParent();
    this.subject.next(this.state);

    // broadcast state change. This is event is subscribed to by UrlSyncManager and UndoManager
    this.getRoot().events.publish(
      new SceneObjectStateChangedEvent({
        prevState,
        newState: this.state,
        partialUpdate: update,
        changedObject: this,
      })
    );
  }

  private getRoot(): SceneObject {
    return !this.parent ? this : this.parent.getRoot();
  }

  activate() {
    this.isActive = true;
    if (Object.prototype.hasOwnProperty.call(this.state, 'inputParams')) {
      const params = (this.state as any).inputParams;
      for (const param in params) {
        if (isSceneObject(params[param])) {
          if (!params[param].isActive) {
            // Input params (data currently) are separate from the layout hierarchy. But they need a way for resolving scoped context,
            // hence they reuse its consumer context
            params[param].setCtxResolver(this.getContext);
            params[param].activate();
          }
        }
        params[param]._refCounter.add(this.state.key);
      }
    }
  }

  deactivate(): void {
    this.isActive = false;

    if (Object.prototype.hasOwnProperty.call(this.state, 'inputParams')) {
      const params = (this.state as any).inputParams;

      for (const param in params) {
        if (isSceneObject(params[param]) && params[param].isActive) {
          if (params[param]._refCounter.size === 1) {
            params[param].deactivate();
          }
          params[param]._refCounter.delete(this.state.key);
        }
      }
    }

    this.subs.unsubscribe();
    this.subs = new Subscription();
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSceneObjectState(this);
  }

  getContext: () => StandardSceneObjectContext = () => {
    // if (isContextObject(this) && !(this.state as SceneContextObjectState).inheritContext) {
    //   return this.ctx;
    // }

    if (this.parent) {
      return this.parent.getContext();
    }

    throw new Error('No context found in scene tree');
  };

  setCtxResolver(resolver: () => StandardSceneObjectContext) {
    this.getContext = resolver;
  }

  /**
   * Will walk up the scene object graph to the closest context object
   */
  getTimeRange(): SceneTimeRange {
    return this.getContext().timeRange;
  }

  /**
   * Will resolve nearest data provider object, based on input params or hierarchy
   */
  getData(): SceneObject<SceneDataState> {
    if (Object.prototype.hasOwnProperty.call(this.state, 'inputParams')) {
      const params = (this.state as any).inputParams;
      for (const param in params) {
        if (params[param] instanceof SceneDataObject) {
          return params[param];
        }
      }
    }

    if (this.parent) {
      return this.parent.getData();
    }

    throw new Error('No data found in scene tree');
  }

  /**
   * Will walk up the scene object graph to the closest $editor scene object
   */
  getSceneEditor(): SceneEditor {
    const { $editor } = this.state;
    if ($editor) {
      return $editor;
    }

    if (this.parent) {
      return this.parent.getSceneEditor();
    }

    throw new Error('No editor found in scene tree');
  }

  /**
   * Will create new SceneItem with shalled cloned state, but all states items of type SceneItem are deep cloned
   */
  clone(withState?: Partial<TState>): this {
    const clonedState = { ...this.state };

    // Clone any SceneItems in state
    for (const key in clonedState) {
      const propValue = clonedState[key];
      if (propValue instanceof SceneObjectBase) {
        clonedState[key] = propValue.clone();
      }
    }

    // Clone layout children
    if ('children' in this.state) {
      const newChildren: SceneLayoutChild[] = [];
      for (const child of this.state.children) {
        newChildren.push(child.clone());
      }
      (clonedState as any).children = newChildren;
    }

    Object.assign(clonedState, withState);

    return new (this.constructor as any)(clonedState);
  }
}

/**
 * This hook is always returning model.state instead of a useState that remembers the last state emitted on the subject
 * The reason for this is so that if the model instance change this function will always return the latest state.
 */
function useSceneObjectState<TState extends SceneObjectState>(model: SceneObjectBase<TState>): TState {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const s = model.subject.subscribe(forceUpdate);
    return () => s.unsubscribe();
  }, [model, forceUpdate]);

  return model.state;
}

export class SceneDataObject<TState extends SceneDataState = SceneDataState> extends SceneObjectBase<TState> {
  getData() {
    return this;
  }
}
