import { map, Observable } from 'rxjs';

import { SelectableValue } from '@grafana/data';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObject } from '../../core/types';
import { SceneVariable, SceneVariableState, ValidateAndUpdateResult, VariableValueOption } from '../types';

export interface MultiValueVariableState extends SceneVariableState {
  options: VariableValueOption[];
  isMulti?: boolean;
}

export interface VariableGetOptionsArgs {
  searchFilter?: string;
}

export abstract class MultiValueVariable<TState extends MultiValueVariableState = MultiValueVariableState>
  extends SceneObjectBase<TState>
  implements SceneVariable<TState>
{
  /**
   * The source of value options. Called when activation or when a dependency changes.
   * Can also be called directly by the value select component with a dynamic search filter.
   */
  abstract getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;

  /**
   * This function is called on activation or when a dependency changes.
   */
  validateAndUpdate(): Observable<ValidateAndUpdateResult> {
    return this.getValueOptions({}).pipe(
      map((options) => {
        this.updateValueGivenNewOptions(this, options);
        return {};
      })
    );
  }

  /**
   * Check if current value is valid given new options. If not update the value.
   * TODO: Handle multi valued variables
   */
  private updateValueGivenNewOptions(variable: SceneVariable, options: VariableValueOption[]) {
    if (options.length === 0) {
      // TODO handle the no value state
      variable.setState({ value: '?', loading: false });
      return;
    }

    const foundCurrent = options.find((x) => x.value === variable.state.value);
    if (!foundCurrent) {
      // Current value is not valid. Set to first of the available options
      variable.setState({ value: options[0].value, text: options[0].label, loading: false });
    } else {
      // current value is still ok
      variable.setState({ loading: false });
    }
  }

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
