import { map, Observable } from 'rxjs';

import { SelectableValue } from '@grafana/data';

import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneObject } from '../../core/types';
import {
  SceneVariable,
  SceneVariableValueChangedEvent,
  SceneVariableState,
  ValidateAndUpdateResult,
  VariableValue,
  VariableValueOption,
} from '../types';

export interface MultiValueVariableState extends SceneVariableState {
  value: string | string[]; // old current.text
  text: string | string[]; // old current.value
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
   * The source of value options.
   */
  public abstract getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;

  /**
   * This function is called on when SceneVariableSet is activated or when a dependency changes.
   */
  public validateAndUpdate(): Observable<ValidateAndUpdateResult> {
    return this.getValueOptions({}).pipe(
      map((options) => {
        this.updateValueGivenNewOptions(options);
        return {};
      })
    );
  }

  /**
   * Check if current value is valid given new options. If not update the value.
   * TODO: Handle multi valued variables
   */
  private updateValueGivenNewOptions(options: VariableValueOption[]) {
    if (options.length === 0) {
      // TODO handle the no value state
      this.setStateHelper({ value: '?', loading: false });
      return;
    }

    const foundCurrent = options.find((x) => x.value === this.state.value);
    if (!foundCurrent) {
      // Current value is not valid. Set to first of the available options
      this.changeValueAndPublishChangeEvent(options[0].value, options[0].label);
    } else {
      // current value is still ok
      this.setStateHelper({ loading: false });
    }
  }

  public getValue(): VariableValue {
    return this.state.value;
  }

  public getValueText(): string {
    if (Array.isArray(this.state.text)) {
      return this.state.text.join(' + ');
    }

    return this.state.text;
  }

  private changeValueAndPublishChangeEvent(value: string | string[], text: string | string[]) {
    if (value !== this.state.value || text !== this.state.text) {
      this.setStateHelper({ value, text, loading: false });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }

  /**
   * This helper function is to counter the contravariance of setState
   */
  private setStateHelper(state: Partial<MultiValueVariableState>) {
    const test: SceneObject<MultiValueVariableState> = this;
    test.setState(state);
  }

  public onSingleValueChange = (value: SelectableValue<string>) => {
    this.changeValueAndPublishChangeEvent(value.value!, value.label!);
  };

  public onMultiValueChange = (value: Array<SelectableValue<string>>) => {
    this.changeValueAndPublishChangeEvent(
      value.map((v) => v.value!),
      value.map((v) => v.label!)
    );
  };
}
