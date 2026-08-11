import type { SceneObject, SceneVariable, SceneVariableSet } from '@grafana/scenes';

export interface AddElementActionHelperProps {
  addedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export interface RemoveElementActionHelperProps {
  removedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export interface AddVariableActionHelperProps {
  addedObject: SceneVariable;
  source: SceneVariableSet;
}

export interface RemoveVariableActionHelperProps {
  removedObject: SceneVariable;
  source: SceneVariableSet;
}

export interface ChangeVariableTypeActionHelperProps {
  oldVariable: SceneVariable;
  newVariable: SceneVariable;
  source: SceneVariableSet;
}

export interface DuplicateElementActionHelperProps<T extends SceneObject = SceneObject> {
  duplicatedObject: T;
  source: SceneObject;
  /** Extra state applied to the clone, e.g. a renamed title. A fresh key is always generated. */
  cloneState?: Partial<T['state']>;
  perform: (duplicate: T) => void;
  undo: (duplicate: T) => void;
}

export interface MoveElementActionHelperProps {
  movedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export interface MakeEditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  description: string;
  prop: T;
}

export interface EditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  source: Source;
  oldValue: Source['state'][T];
  newValue: Source['state'][T];
}
