import { isEqual } from 'lodash';
import { map, Observable } from 'rxjs';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

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
  value: VariableValue; // old current.text
  text: VariableValue; // old current.value
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
   */
  private updateValueGivenNewOptions(options: VariableValueOption[]) {
    const stateUpdate: Partial<MultiValueVariableState> = {
      options,
      loading: false,
      value: this.state.value,
      text: this.state.text,
    };

    if (options.length === 0) {
      // TODO handle the no value state
    } else if (this.hasAllValue()) {
      // If value is set to All then we keep it set to All but just store the options
    } else if (this.state.isMulti) {
      // If we are a multi valued variable validate the current values are among the options
      const currentValues = Array.isArray(this.state.value) ? this.state.value : [this.state.value];
      const validValues = currentValues.filter((v) => options.find((o) => o.value === v));

      // If no valid values pick the first option
      if (validValues.length === 0) {
        stateUpdate.value = [options[0].value];
        stateUpdate.text = [options[0].label];
      }
      // We have valid values, if it's different from current valid values update current values
      else if (!isEqual(validValues, this.state.value)) {
        const validTexts = validValues.map((v) => options.find((o) => o.value === v)!.label);
        stateUpdate.value = validValues;
        stateUpdate.text = validTexts;
      }
    } else {
      // Single valued variable
      const foundCurrent = options.find((x) => x.value === this.state.value);
      if (!foundCurrent) {
        // Current value is not valid. Set to first of the available options
        stateUpdate.value = options[0].value;
        stateUpdate.text = options[0].label;
      }
    }

    // Remember current value and text
    const { value: prevValue, text: prevText } = this.state;

    // Perform state change
    this.setStateHelper(stateUpdate);

    // Publish value changed event only if value changed
    if (stateUpdate.value !== prevValue || stateUpdate.text !== prevText || this.hasAllValue()) {
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }

  public getValue(): VariableValue {
    if (this.hasAllValue()) {
      return this.state.options.map((x) => x.value);
    }

    return this.state.value;
  }

  public getValueText(): string {
    if (this.hasAllValue()) {
      return ALL_VARIABLE_TEXT;
    }

    if (Array.isArray(this.state.text)) {
      return this.state.text.join(' + ');
    }

    return String(this.state.text);
  }

  private hasAllValue() {
    const value = this.state.value;
    return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
  }

  private setStateAndPublishValueChangedEvent(state: Partial<MultiValueVariableState>) {
    this.setStateHelper(state);
  }

  /**
   * Change the value and publish SceneVariableValueChangedEvent event
   */
  public changeValueTo(value: VariableValue, text?: VariableValue) {
    if (value !== this.state.value || text !== this.state.text) {
      this.setStateAndPublishValueChangedEvent({ value, text, loading: false });
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
}
