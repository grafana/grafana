import { Observable, of } from 'rxjs';

import { SceneVariableState, VariableGetOptionsArgs, VariableValueOption } from '../types';

import { SceneVariableBase } from './SceneVariableBase';

export interface ConstantVariableState extends SceneVariableState {
  value: string;
  text: string;
}

export class ConstantVariable extends SceneVariableBase<ConstantVariableState> {
  getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    return of([{ value: this.state.value, label: this.state.text }]);
  }
}
