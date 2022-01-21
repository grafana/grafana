import { DashboardPicker, DashboardPickerOptions } from './DashboardPicker';
import { getStandardFieldConfigs, getStandardOptionEditors } from '@grafana/ui';
import {
  FieldConfigPropertyItem,
  FieldType,
  standardEditorsRegistry,
  StandardEditorsRegistryItem,
  ValueMapping,
  ValueMappingFieldConfigSettings,
  valueMappingsOverrideProcessor,
} from '@grafana/data';
import { ValueMappingsValueEditor } from 'app/features/dimensions/editors/ValueMappingsEditor/mappings';

/**
 * Returns collection of standard option editors definitions
 */
export const getAllOptionEditors = () => {
  const dashboardPicker: StandardEditorsRegistryItem<string, DashboardPickerOptions> = {
    id: 'dashboard-uid',
    name: 'Dashboard',
    description: 'Select dashboard',
    editor: DashboardPicker as any,
  };

  const mappings: StandardEditorsRegistryItem<ValueMapping[]> = {
    id: 'mappings',
    name: 'Mappings',
    description: 'Allows defining value mappings',
    editor: ValueMappingsValueEditor as any,
  };

  return [...getStandardOptionEditors(), dashboardPicker, mappings];
};

/**
 * Returns collection of common field config properties definitions
 */
export const getAllStandardFieldConfigs = () => {
  const mappings: FieldConfigPropertyItem<any, ValueMapping[], ValueMappingFieldConfigSettings> = {
    id: 'mappings',
    path: 'mappings',
    name: 'Value mappings',
    description: 'Modify the display text based on input value',

    editor: standardEditorsRegistry.get('mappings').editor as any,
    override: standardEditorsRegistry.get('mappings').editor as any,
    process: valueMappingsOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: (x) => x.type !== FieldType.time,
    category: ['Value mappings'],
    getItemsCount: (value?) => (value ? value.length : 0),
  };

  return [...getStandardFieldConfigs(), mappings];
};
