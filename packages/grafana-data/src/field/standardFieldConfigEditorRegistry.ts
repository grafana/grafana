import { ComponentType } from 'react';

import { EventBus } from '../events';
import { DataFrame, InterpolateFunction, VariableSuggestionsScope, VariableSuggestion } from '../types';
import { Registry, RegistryItem } from '../utils/Registry';

import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';

export interface StandardEditorContext<TOptions, TState = any> {
  data: DataFrame[]; // All results
  replaceVariables?: InterpolateFunction;
  eventBus?: EventBus;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
  options?: TOptions;
  instanceState?: TState;
  isOverride?: boolean;
}

export interface StandardEditorProps<TValue = any, TSettings = any, TOptions = any, TState = any> {
  value: TValue;
  onChange: (value?: TValue) => void;
  item: StandardEditorsRegistryItem<TValue, TSettings>;
  context: StandardEditorContext<TOptions, TState>;
  id?: string;
}
export interface StandardEditorsRegistryItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<StandardEditorProps<TValue, TSettings>>;
  settings?: TSettings;
}
export const standardFieldConfigEditorRegistry = new FieldConfigOptionsRegistry();

export const standardEditorsRegistry = new Registry<StandardEditorsRegistryItem<any>>();
