import { Registry, RegistryItem } from '../utils/Registry';
import { ComponentType } from 'react';
import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { DataFrame, InterpolateFunction, VariableSuggestionsScope, VariableSuggestion } from '../types';

export interface StandardEditorContext<TOptions> {
  data?: DataFrame[]; // All results
  replaceVariables?: InterpolateFunction;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
  options?: TOptions;
}

export interface StandardEditorProps<TValue = any, TSettings = any, TOptions = any> {
  value: TValue;
  onChange: (value?: TValue) => void;
  item: StandardEditorsRegistryItem<TValue, TSettings>;
  context: StandardEditorContext<TOptions>;
}
export interface StandardEditorsRegistryItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<StandardEditorProps<TValue, TSettings>>;
  settings?: TSettings;
}
export const standardFieldConfigEditorRegistry = new FieldConfigOptionsRegistry();

export const standardEditorsRegistry = new Registry<StandardEditorsRegistryItem<any>>();
