import {
  FieldConfigPropertyItem,
  FieldType,
  standardEditorsRegistry,
  StandardEditorsRegistryItem,
  ThresholdsConfig,
  ThresholdsFieldConfigSettings,
  ThresholdsMode,
  thresholdsOverrideProcessor,
  ValueMapping,
  ValueMappingFieldConfigSettings,
  valueMappingsOverrideProcessor,
} from '@grafana/data';
import { getStandardFieldConfigs, getStandardOptionEditors } from '@grafana/ui';
import { ThresholdsValueEditor } from 'app/features/dimensions/editors/ThresholdsEditor/thresholds';
import { ValueMappingsEditor } from 'app/features/dimensions/editors/ValueMappingsEditor/ValueMappingsEditor';

import { DashboardPicker, DashboardPickerOptions } from './DashboardPicker';

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
    editor: ValueMappingsEditor as any,
  };

  const thresholds: StandardEditorsRegistryItem<ThresholdsConfig> = {
    id: 'thresholds',
    name: 'Thresholds',
    description: 'Allows defining thresholds',
    editor: ThresholdsValueEditor as any,
  };

  return [...getStandardOptionEditors(), dashboardPicker, mappings, thresholds];
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

  const thresholds: FieldConfigPropertyItem<any, ThresholdsConfig, ThresholdsFieldConfigSettings> = {
    id: 'thresholds',
    path: 'thresholds',
    name: 'Thresholds',
    editor: standardEditorsRegistry.get('thresholds').editor as any,
    override: standardEditorsRegistry.get('thresholds').editor as any,
    process: thresholdsOverrideProcessor,
    settings: {},
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
    shouldApply: () => true,
    category: ['Thresholds'],
    getItemsCount: (value) => (value ? value.steps.length : 0),
  };

  return [...getStandardFieldConfigs(), mappings, thresholds];
};
