import { LoadingState } from '@grafana/data';
import { VariableHide } from 'app/features/variables/types';

import { SceneObject, SceneObjectState } from '../core/types';

export interface SceneVariableState extends SceneObjectState {
  name: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  state?: LoadingState;
  error?: any | null;
  description?: string | null;
  current: { value: string; text?: string };
}

export interface SceneVariable extends SceneObject<SceneVariableState> {}

export interface SceneVariableSetState extends SceneObjectState {
  variables: SceneVariable[];
}

export interface SceneVariableSet extends SceneObject<SceneVariableSetState> {
  getVariableByName(name: string): SceneVariable | undefined;
}
