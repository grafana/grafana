import { SelectableValue } from '@grafana/data';

import { SceneObject } from '../../core/types';
import { SceneVariableState, VariableValueOption } from '../types';

import { SceneVariableBase } from './SceneVariableBase';

export interface MultiValueVariableState extends SceneVariableState {
  options: VariableValueOption[];
  isMulti?: boolean;
}

export abstract class MultiValueVariable<
  TState extends MultiValueVariableState = MultiValueVariableState
> extends SceneVariableBase<TState> {
  /**
   * This helper function is to counter the contravariance of setState
   */
  setStateHelper(state: Partial<MultiValueVariableState>) {
    const test: SceneObject<MultiValueVariableState> = this;
    test.setState(state);
  }

  onSingleValueChange = (value: SelectableValue<string>) => {
    this.setStateHelper({ value: value.value, text: value.label });
  };

  onMultiValueChange = (value: Array<SelectableValue<string>>) => {
    this.setStateHelper({ value: value.map((v) => v.value!), text: value.map((v) => v.label!) });
  };
}
