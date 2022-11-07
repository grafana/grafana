import { useEffect } from 'react';
import { Observer, Subject, Subscription, Unsubscribable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { BusEvent, BusEventHandler, BusEventType, EventBusSrv } from '@grafana/data';
import { useForceUpdate } from '@grafana/ui';

import { SceneComponentWrapper } from './SceneComponentWrapper';
import { SceneObjectStateChangedEvent } from './events';
import { SceneDataState, SceneObject, SceneComponent, SceneEditor, SceneTimeRange, SceneObjectState } from './types';

export abstract class SceneObjectBase<TState extends SceneObjectState = {}> implements SceneObject<TState> {
  private _isActive = false;
  private _subject = new Subject<TState>();
  private _state: TState;
  private _events = new EventBusSrv();

  protected _parent?: SceneObject;
  protected subs = new Subscription();

  constructor(state: TState) {
    if (!state.key) {
      state.key = uuidv4();
    }

    this._state = state;
    this._subject.next(state);
    this.setParent();
  }

  /** Current state */
  get state(): TState {
    return this._state;
  }

  /** True if currently being active (ie displayed for visual objects) */
  get isActive(): boolean {
    return this._isActive;
  }

  /** Returns the parent, undefined for root object */
  get parent(): SceneObject | undefined {
    return this._parent;
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
    for (const propValue of Object.values(this._state)) {
      if (propValue instanceof SceneObjectBase) {
        propValue._parent = this;
      }

      if (Array.isArray(propValue)) {
        for (const child of propValue) {
          if (child instanceof SceneObjectBase) {
            child._parent = this;
          }
        }
      }
    }
  }

  /**
   * Subscribe to the scene state subject
   **/
  subscribeToState(observerOrNext?: Partial<Observer<TState>>): Subscription {
    return this._subject.subscribe(observerOrNext);
  }

  /**
   * Subscribe to the scene event
   **/
  subscribeToEvent<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this._events.subscribe(eventType, handler);
  }

  setState(update: Partial<TState>) {
    const prevState = this._state;
    this._state = {
      ...this._state,
      ...update,
    };
    this.setParent();
    this._subject.next(this._state);

    // Bubble state change event. This is event is subscribed to by UrlSyncManager and UndoManager
    this.publishEvent(
      new SceneObjectStateChangedEvent({
        prevState,
        newState: this._state,
        partialUpdate: update,
        changedObject: this,
      }),
      true
    );
  }

  /*
   * Publish an event and optionally bubble it up the scene
   **/
  publishEvent(event: BusEvent, bubble?: boolean) {
    this._events.publish(event);

    if (bubble && this.parent) {
      this.parent.publishEvent(event, bubble);
    }
  }

  getRoot(): SceneObject {
    return !this._parent ? this : this._parent.getRoot();
  }

  activate() {
    this._isActive = true;

    const { $data, $variables } = this.state;

    if ($data && !$data.isActive) {
      $data.activate();
    }

    if ($variables && !$variables.isActive) {
      $variables.activate();
    }
  }

  deactivate(): void {
    this._isActive = false;

    const { $data, $variables } = this.state;

    if ($data && $data.isActive) {
      $data.deactivate();
    }

    if ($variables && $variables.isActive) {
      $variables.deactivate();
    }

    // Clear subscriptions and listeners
    this._events.removeAllListeners();
    this.subs.unsubscribe();
    this.subs = new Subscription();

    this._subject.complete();
    this._subject = new Subject<TState>();
  }

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSceneObjectState(this);
  }

  /**
   * Will walk up the scene object graph to the closest $timeRange scene object
   */
  getTimeRange(): SceneTimeRange {
    const { $timeRange } = this.state;
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
  getData(): SceneObject<SceneDataState> {
    const { $data } = this.state;
    if ($data) {
      return $data;
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
   * Will create new SceneItem with shalled cloned state, but all states items of type SceneObject are deep cloned
   */
  clone(withState?: Partial<TState>): this {
    const clonedState = { ...this.state };

    // Clone any SceneItems in state
    for (const key in clonedState) {
      const propValue = clonedState[key];
      if (propValue instanceof SceneObjectBase) {
        clonedState[key] = propValue.clone();
      }

      // Clone scene objects in arrays
      if (Array.isArray(propValue)) {
        const newArray: any = [];
        for (const child of propValue) {
          if (child instanceof SceneObjectBase) {
            newArray.push(child.clone());
          } else {
            newArray.push(child);
          }
        }
        clonedState[key] = newArray;
      }
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
    const s = model.subscribeToState({ next: forceUpdate });
    return () => s.unsubscribe();
  }, [model, forceUpdate]);

  return model.state;
}
