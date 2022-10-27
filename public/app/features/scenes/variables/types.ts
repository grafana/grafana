import { Observable } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { VariableHide } from 'app/features/variables/types';

import { SceneComponent, SceneObject, SceneObjectStatePlain } from '../core/types';

export interface SceneVariableState extends SceneObjectStatePlain {
  name: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  state?: LoadingState;
  error?: any | null;
  description?: string | null;
  text: string | string[]; // old current.text
  value: string | string[]; // old current.value
}

export interface SceneVariable<T extends SceneVariableState = SceneVariableState> extends SceneObject<T> {
  ValueSelectComponent?: SceneComponent<SceneVariable>;
  getDependencies?(): string[];
  updateOptions?(context: VariableUpdateContext): Observable<number>;
}

export interface VariableUpdateContext {
  sceneContext: SceneObject;
  searchFilter?: string;
}

export interface SceneVariableSetState extends SceneObjectStatePlain {
  variables: SceneVariable[];
}

export interface SceneVariableSet extends SceneObject<SceneVariableSetState> {
  getVariableByName(name: string): SceneVariable | undefined;
}
