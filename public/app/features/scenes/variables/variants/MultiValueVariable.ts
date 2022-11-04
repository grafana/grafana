import { VariableOption } from '@grafana/data';
import { NavigationKey } from 'app/features/variables/pickers/types';

import { SceneObject } from '../../core/types';
import { SceneVariableState, VariableValueOption } from '../types';

import { SceneVariableBase } from './SceneVariableBase';

export interface MultiValueVariableState extends SceneVariableState {
  options: VariableValueOption[];
  isSelectOpen?: boolean;
  isMulti?: boolean;
  highlightIndex?: number;
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

  onCloseSelect = () => {
    this.setStateHelper({ isSelectOpen: false });
  };

  onOpenSelect = () => {
    this.setStateHelper({ isSelectOpen: true });
  };

  onFilterOrSearchOptions = (value: string) => {};

  onNavigate = (key: NavigationKey, clearOthers: boolean) => {};

  getOldPickerOptions(): VariableOption[] {
    return this.state.options.map((op) => ({
      selected: false,
      text: op.label ?? op.value ?? '',
      value: op.value ?? '',
    }));
  }

  onToggleOption = (option: VariableOption, clearOthers: boolean) => {};
  onToggleAllOptions = () => {};
}
