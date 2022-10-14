import React from 'react';
import { Subscribable } from 'rxjs';

import { EventBus, PanelData, TimeRange, UrlQueryMap } from '@grafana/data';

import { SceneVariableSet } from '../variables/types';

import { SceneDataObject } from './SceneObjectBase';

export interface SceneObjectStatePlain {
  key?: string;
  $editor?: SceneEditor;
  $variables?: SceneVariableSet;
}

export interface SceneLayoutChildState extends SceneObjectStatePlain {
  size?: SceneObjectSize;
}

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

export interface SceneObject<TState extends SceneObjectState = SceneObjectState> extends Subscribable<TState> {
  /** The current state */
  state: TState;

  /** True when there is a React component mounted for this Object */
  isActive?: boolean;

  /** SceneObject parent */
  parent?: SceneObject;

  /** Currently only used from root to broadcast events */
  events: EventBus;

  /** Utility hook that wraps useObservable. Used by React components to subscribes to state changes */
  useState(): TState;

  /** How to modify state */
  setState(state: Partial<TState>): void;

  /** Called when the Component is mounted. A place to register event listeners add subscribe to state changes */
  activate(): void;

  /** Called when component unmounts. Unsubscribe to events */
  deactivate(): void;

  /** Get the scene editor */
  getSceneEditor(): SceneEditor;

  /** Returns a deep clone this object and all its children */
  clone(state?: Partial<TState>): this;

  /** A React component to use for rendering the object */
  Component(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;

  /** To be replaced by declarative method */
  Editor(props: SceneComponentProps<SceneObject<TState>>): React.ReactElement | null;
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

export interface SceneTimeRangeState extends SceneObjectStatePlain {
  range: TimeRange;
}
export interface SceneTimeRange extends SceneObject<SceneTimeRangeState> {
  onTimeRangeChange(timeRange: TimeRange): void;
  onIntervalChanged(interval: string): void;
  onRefresh(): void;
}

export interface SceneObjectRef {
  ref: SceneObject;
}

export function isSceneObject(obj: any): obj is SceneObject {
  return Boolean(obj) && obj.useState !== undefined;
}

/** These functions are still just temporary until this get's refined */
export interface SceneObjectWithUrlSync extends SceneObject {
  getUrlState(): UrlQueryMap;
  updateFromUrl(values: UrlQueryMap): void;
}

/** Standard query execution context */
export interface StandardSceneObjectContext {
  timeRange: SceneTimeRange;
  variables: any[];
}

/** State used by objects that can provide data within a scene */
export interface SceneDataState extends SceneObjectStatePlain {
  $data?: PanelData;
}

/** Statete used by objects that can consume data-providing objects */
export type DataInputState<
  TState extends SceneDataState,
  T extends SceneDataObject<TState> = SceneDataObject<TState>
> = {
  $data: T;
};
