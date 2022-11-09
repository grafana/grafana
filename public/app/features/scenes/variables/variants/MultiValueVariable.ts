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
   * TODO: Handle multi valued variables
   */
  private updateValueGivenNewOptions(options: VariableValueOption[]) {
    if (options.length === 0) {
      // TODO handle the no value state
      this.setStateHelper({ value: '?', loading: false, options });
      return;
    }

    // If value is set to All then we keep it set to All but just store the options
    if (this.hasAllValue()) {
      this.setStateHelper({ options, loading: false });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
      return;
    }

    const foundCurrent = options.find((x) => x.value === this.state.value);
    if (!foundCurrent) {
      // Current value is not valid. Set to first of the available options
      this.setStateHelper({ value: options[0].value, text: options[0].label, loading: false, options });
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    } else {
      // current value is still ok
      this.setStateHelper({ loading: false, options });
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

  /**
   * Change the value and publish SceneVariableValueChangedEvent event
   */
  public changeValueTo(value: VariableValue, text?: VariableValue) {
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
}
