import { type SceneObject, type SceneVariable, type SceneVariableSet } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';

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

export interface ChangeTitleActionHelperProps {
  oldTitle: string;
  newTitle: string;
  source: DashboardScene;
}

export interface ChangeDescriptionActionHelperProps {
  oldDescription: string;
  newDescription: string;
  source: DashboardScene;
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
