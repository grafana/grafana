import { Registry, RegistryItem } from '../utils/Registry';
import { ComponentType } from 'react';
import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { DataFrame, InterpolateFunction, VariableSuggestionsScope, VariableSuggestion } from '../types';
import { EventBus } from '../events';

export interface StandardEditorContext<TOptions> {
  data: DataFrame[]; // All results
  replaceVariables?: InterpolateFunction;
  eventBus?: EventBus;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
  options?: TOptions;
  isOverride?: boolean;
}

export interface StandardEditorProps<TValue = any, TSettings = any, TOptions = any, TBuilder = any> {
  value: TValue;
  onChange: (value?: TValue) => void;
  item: StandardEditorsRegistryItem<TValue, TSettings>;
  context: StandardEditorContext<TOptions> & { builder: TBuilder; path: string };
}
export interface StandardEditorsRegistryItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<StandardEditorProps<TValue, TSettings>>;
  settings?: TSettings;
}
export const standardFieldConfigEditorRegistry = new FieldConfigOptionsRegistry();

export const standardEditorsRegistry = new Registry<StandardEditorsRegistryItem<any>>();
