import { type ComponentType } from 'react';

import { type EventBus } from '../events/types';
import { type DataFrame } from '../types/dataFrame';
import { type VariableSuggestionsScope, type VariableSuggestion } from '../types/dataLink';
import { type InterpolateFunction } from '../types/panel';
import { Registry, type RegistryItem } from '../utils/Registry';

import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';

export interface StandardEditorContext<TOptions, TState = any> {
  data: DataFrame[]; // All results
  replaceVariables?: InterpolateFunction;
  eventBus?: EventBus;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
  options?: TOptions;
  instanceState?: TState;
  isOverride?: boolean;
  annotations?: DataFrame[];
}

export interface StandardEditorProps<TValue = any, TSettings = any, TOptions = any, TState = any> {
  value: TValue;
  /**
   * Commits a new value for the option this editor is registered against.
   *
   * How an object value is applied depends on where the editor is registered:
   *
   * - **Panel options** are merged into the current value, so leaving a key out does not remove it.
   *   Set the key to `undefined` to clear it — `onChange({ ...value, age: undefined })` clears `age`,
   *   whereas passing an object that simply omits `age` leaves the old value in place.
   * - **Field config** values are replaced, so leaving a key out does remove it.
   */
  onChange: (value?: TValue) => void;
  context: StandardEditorContext<TOptions, TState>;
  id?: string;

  item: RegistryItem & {
    settings?: TSettings;
  };
}

export interface StandardEditorsRegistryItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<StandardEditorProps<TValue, TSettings>>;
  settings?: TSettings;
}
export const standardFieldConfigEditorRegistry = new FieldConfigOptionsRegistry();

export const standardEditorsRegistry = new Registry<StandardEditorsRegistryItem>();
