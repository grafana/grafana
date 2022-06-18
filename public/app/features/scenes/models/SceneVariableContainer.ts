import { LoadingState } from '@grafana/data';
import { VariableHide } from 'app/features/variables/types';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectState } from './types';

export interface SceneVariableContainerState extends SceneObjectState {}

export class SceneVariableContainer extends SceneObjectBase<SceneVariableContainerState> {}

export interface SceneVariableState extends SceneObjectState {
  name: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  state?: LoadingState;
  error?: any | null;
  description?: string | null;
}

export class SceneVariable<T extends SceneVariableState> extends SceneObjectBase<T> {}
