import { Observable } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { VariableHide } from 'app/features/variables/types';

import { SceneObject, SceneObjectStatePlain } from '../core/types';

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

export interface SceneVariable extends SceneObject<SceneVariableState> {
  updateOptions?(context: VariableUpdateContext): Observable<number>;
}

export interface VariableUpdateContext {
  sceneLocation: SceneObject;
  searchFilter?: string;
}

export interface SceneVariableSetState extends SceneObjectStatePlain {
  variables: SceneVariable[];
}

export interface SceneVariableSet extends SceneObject<SceneVariableSetState> {
  getVariableByName(name: string): SceneVariable | undefined;
}
