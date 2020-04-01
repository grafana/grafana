import { FieldConfigEditorRegistry, FieldPropertyEditorItem } from '../types/fieldOverrides';
import { Registry, RegistryItem } from '../utils/Registry';
import { ComponentType } from 'react';

export interface StandardEditorProps<TValue = any, TSettings = any> {
  value: TValue;
  onChange: (value?: TValue) => void;
  item: StandardEditorsRegistryItem<TValue, TSettings>;
}
export interface StandardEditorsRegistryItem<TValue = any, TSettings = any> extends RegistryItem {
  editor: ComponentType<StandardEditorProps<TValue, TSettings>>;
  settings?: TSettings;
}
export const standardFieldConfigEditorRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>();

export const standardEditorsRegistry = new Registry<StandardEditorsRegistryItem<any>>();
