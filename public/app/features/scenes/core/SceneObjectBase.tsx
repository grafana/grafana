import { useEffect } from 'react';
import { Observer, Subject, Subscription, Unsubscribable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { BusEvent, BusEventHandler, BusEventType, EventBusSrv } from '@grafana/data';
import { useForceUpdate } from '@grafana/ui';

import { sceneTemplateInterpolator } from '../variables/sceneTemplateInterpolator';
import { SceneVariables, SceneVariableDependencyConfigLike } from '../variables/types';

import { SceneComponentWrapper } from './SceneComponentWrapper';
import { SceneObjectStateChangedEvent } from './events';
import {
  SceneDataState,
  SceneObject,
  SceneComponent,
  SceneEditor,
  SceneTimeRange,
  SceneObjectState,
  SceneLayoutState,
} from './types';
import { cloneSceneObject, forEachSceneObjectInState } from './utils';

export abstract class SceneObjectBase<TState extends SceneObjectState = SceneObjectState>
  implements SceneObject<TState>
{
  private _isActive = false;
  private _subject = new Subject<TState>();
  private _state: TState;
  private _events = new EventBusSrv();

  /** Incremented in SceneComponentWrapper, useful for tests and rendering optimizations */
  protected _renderCount = 0;
  protected _parent?: SceneObject;
  protected _subs = new Subscription();

  protected _variableDependency: SceneVariableDependencyConfigLike | undefined;

  public constructor(state: TState) {
    if (!state.key) {
      state.key = uuidv4();
    }

    this._state = state;
    this._subject.next(state);
    this.setParent();
  }

  /** Current state */
  public get state(): TState {
    return this._state;
  }

  /** True if currently being active (ie displayed for visual objects) */
  public get isActive(): boolean {
    return this._isActive;
  }

  /** Returns the parent, undefined for root object */
  public get parent(): SceneObject | undefined {
    return this._parent;
  }

  /** Returns variable dependency config */
  public get variableDependency(): SceneVariableDependencyConfigLike | undefined {
    return this._variableDependency;
  }

  /**
   * Used in render functions when rendering a SceneObject.
   * Wraps the component in an EditWrapper that handles edit mode
   */
  public get Component(): SceneComponent<this> {
    return SceneComponentWrapper;
  }

  /**
   * Temporary solution, should be replaced by declarative options
   */
  public get Editor(): SceneComponent<this> {
    return ((this as any).constructor['Editor'] ?? (() => null)) as SceneComponent<this>;
  }

  private setParent() {
    forEachSceneObjectInState(this._state, (child) => (child._parent = this));
  }

  /**
   * Subscribe to the scene state subject
   **/
  public subscribeToState(observerOrNext?: Partial<Observer<TState>>): Subscription {
    return this._subject.subscribe(observerOrNext);
  }

  /**
   * Subscribe to the scene event
   **/
  public subscribeToEvent<T extends BusEvent>(eventType: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable {
    return this._events.subscribe(eventType, handler);
  }

  public setState(update: Partial<TState>) {
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
  public publishEvent(event: BusEvent, bubble?: boolean) {
    this._events.publish(event);

    if (bubble && this.parent) {
      this.parent.publishEvent(event, bubble);
    }
  }

  public getRoot(): SceneObject {
    return !this._parent ? this : this._parent.getRoot();
  }

  /**
   * Called by the SceneComponentWrapper when the react component is mounted
   */
  public activate() {
    this._isActive = true;

    const { $data, $variables } = this.state;

    if ($data && !$data.isActive) {
      $data.activate();
    }

    if ($variables && !$variables.isActive) {
      $variables.activate();
    }
  }

  /**
   * Called by the SceneComponentWrapper when the react component is unmounted
   */
  public deactivate(): void {
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
    this._subs.unsubscribe();
    this._subs = new Subscription();

    this._subject.complete();
    this._subject = new Subject<TState>();
  }

  /**
   * Utility hook to get and subscribe to state
   */
  public useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSceneObjectState(this);
  }

  /**
   * Will walk up the scene object graph to the closest $timeRange scene object
   */
  public getTimeRange(): SceneTimeRange {
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
  public getData(): SceneObject<SceneDataState> {
    const { $data } = this.state;
    if ($data) {
      return $data;
    }

    if (this.parent) {
      return this.parent.getData();
    }

    throw new Error('No data found in scene tree');
  }

  public getVariables(): SceneVariables | undefined {
    if (this.state.$variables) {
      return this.state.$variables;
    }

    if (this.parent) {
      return this.parent.getVariables();
    }

    return undefined;
  }

  /**
   * Will walk up the scene object graph to the closest $layout scene object
   */
  public getLayout(): SceneObject<SceneLayoutState> {
    if (this.constructor.name === 'SceneFlexLayout' || this.constructor.name === 'SceneGridLayout') {
      return this as SceneObject<SceneLayoutState>;
    }

    if (this.parent) {
      return this.parent.getLayout();
    }

    throw new Error('No layout found in scene tree');
  }

  /**
   * Will walk up the scene object graph to the closest $editor scene object
   */
  public getSceneEditor(): SceneEditor {
    const { $editor } = this.state;
    if ($editor) {
      return $editor;
    }

    if (this.parent) {
      return this.parent.getSceneEditor();
    }

    throw new Error('No editor found in scene tree');
  }

  /** Force a re-render, should only be needed when variable values change */
  public forceRender(): void {
    this.setState({});
  }

  /**
   * Will create new SceneObject with shallow-cloned state, but all state items of type SceneObject are deep cloned
   */
  public clone(withState?: Partial<TState>): this {
    return cloneSceneObject(this, withState);
  }

  /**
   * Interpolates the given string using the current scene object as context.
   * TODO: Cache interpolatinos?
   */
  public interpolate(value: string | undefined) {
    // Skip interpolation if there are no variable depdendencies
    if (!value || !this._variableDependency || this._variableDependency.getNames().size === 0) {
      return value;
    }

    return sceneTemplateInterpolator(value, this);
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
