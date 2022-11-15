import React from 'react';
import { Observer, Subscription, Unsubscribable } from 'rxjs';

import { BusEvent, BusEventHandler, BusEventType, PanelData, TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneVariableDependencyConfigLike, SceneVariables } from '../variables/types';

export interface SceneObjectStatePlain {
  key?: string;
  $timeRange?: SceneTimeRange;
  $data?: SceneObject<SceneDataState>;
  $editor?: SceneEditor;
  $variables?: SceneVariables;
}

export interface SceneLayoutChildSize {
  size?: SceneObjectSize;
}
export interface SceneLayoutChildInteractions {
  isDraggable?: boolean;
  isResizable?: boolean;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
}

export interface SceneLayoutChildState
  extends SceneObjectStatePlain,
    SceneLayoutChildSize,
    SceneLayoutChildInteractions {}

export type SceneObjectState = SceneObjectStatePlain | SceneLayoutState | SceneLayoutChildState;

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

export interface SceneDataState extends SceneObjectStatePlain {
  data?: PanelData;
}

export interface SceneObject<TState extends SceneObjectState = SceneObjectState> {
  /** The current state */
  readonly state: TState;

  /** True when there is a React component mounted for this Object */
  readonly isActive: boolean;

  /** SceneObject parent */
  readonly parent?: SceneObject;

  /** This abtractions declares what variables the scene object depends on and how to handle when they change value. **/
  readonly variableDependency?: SceneVariableDependencyConfigLike;

  /** Subscribe to state changes */
  subscribeToState(observer?: Partial<Observer<TState>>): Subscription;

  /** Subscribe to a scene event */
  subscribeToEvent<T extends BusEvent>(typeFilter: BusEventType<T>, handler: BusEventHandler<T>): Unsubscribable;

  /** Publish an event and optionally bubble it up the scene */
  publishEvent(event: BusEvent, bubble?: boolean): void;

  /** Utility hook that wraps useObservable. Used by React components to subscribes to state changes */
  useState(): TState;

  /** How to modify state */
  setState(state: Partial<TState>): void;

  /** Called when the Component is mounted. A place to register event listeners add subscribe to state changes */
  activate(): void;

  /** Called when component unmounts. Unsubscribe and closes all subscriptions  */
  deactivate(): void;

  /** Get the scene editor */
  getSceneEditor(): SceneEditor;

  /** Get the scene root */
  getRoot(): SceneObject;

  /** Get the closest node with data */
  getData(): SceneObject<SceneDataState>;

  /** Get the closest node with variables */
  getVariables(): SceneVariables | undefined;

  /** Get the closest node with time range */
  getTimeRange(): SceneTimeRange;

  /** Get the closest layout node */
  getLayout(): SceneObject<SceneLayoutState>;

  /** Returns a deep clone this object and all its children */
  clone(state?: Partial<TState>): this;

  /** A React component to use for rendering the object */
  Component(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;

  /** To be replaced by declarative method */
  Editor(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;

  /** Force a re-render, should only be needed when variable values change */
  forceRender(): void;
}

export type SceneLayoutChild = SceneObject<SceneLayoutChildState | SceneLayoutState>;

export interface SceneLayoutState extends SceneLayoutChildState {
  children: SceneLayoutChild[];
}

export type SceneLayout<T extends SceneLayoutState = SceneLayoutState> = SceneObject<T>;

export interface SceneEditorState extends SceneObjectStatePlain {
  hoverObject?: SceneObjectRef;
  selectedObject?: SceneObjectRef;
}

export interface SceneEditor extends SceneObject<SceneEditorState> {
  onMouseEnterObject(model: SceneObject): void;
  onMouseLeaveObject(model: SceneObject): void;
  onSelectObject(model: SceneObject): void;
}

export interface SceneTimeRangeState extends SceneObjectStatePlain, TimeRange {}

export interface SceneTimeRange extends SceneObject<SceneTimeRangeState> {
  onTimeRangeChange(timeRange: TimeRange): void;
  onIntervalChanged(interval: string): void;
  onRefresh(): void;
}

export interface SceneObjectRef {
  ref: SceneObject;
}

export function isSceneObject(obj: any): obj is SceneObject {
  return obj.useState !== undefined;
}

/** These functions are still just temporary until this get's refined */
export interface SceneObjectWithUrlSync extends SceneObject {
  getUrlState(): UrlQueryMap;
  updateFromUrl(values: UrlQueryMap): void;
}
