import { BooleanFieldSettings } from '@react-awesome-query-builder/ui';

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
  DataLink,
  dataLinksOverrideProcessor,
  NumberFieldConfigSettings,
  numberOverrideProcessor,
  StringFieldConfigSettings,
  stringOverrideProcessor,
  identityOverrideProcessor,
  TimeZone,
  FieldColor,
  FieldColorConfigSettings,
  StatsPickerConfigSettings,
  displayNameOverrideProcessor,
  FieldNamePickerConfigSettings,
  booleanOverrideProcessor,
  Action,
  DataLinksFieldConfigSettings,
} from '@grafana/data';
import { actionsOverrideProcessor } from '@grafana/data/src/field/overrides/processors';
import { FieldConfig } from '@grafana/schema';
import { RadioButtonGroup, TimeZonePicker, Switch } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { ThresholdsValueEditor } from 'app/features/dimensions/editors/ThresholdsEditor/thresholds';
import { ValueMappingsEditor } from 'app/features/dimensions/editors/ValueMappingsEditor/ValueMappingsEditor';

import { DashboardPicker, DashboardPickerOptions } from './DashboardPicker';
import { ActionsValueEditor } from './actions';
import { ColorValueEditor, ColorValueEditorSettings } from './color';
import { FieldColorEditor } from './fieldColor';
import { DataLinksValueEditor } from './links';
import { MultiSelectValueEditor } from './multiSelect';
import { NumberValueEditor } from './number';
import { SelectValueEditor } from './select';
import { SliderValueEditor } from './slider';
import { StatsPickerEditor } from './stats';
import { StringValueEditor } from './string';
import { StringArrayEditor } from './strings';
import { UnitValueEditor } from './units';

/**
 * Returns collection of standard option editors definitions
 */
export const getAllOptionEditors = () => {
  const number: StandardEditorsRegistryItem<number> = {
    id: 'number',
    name: 'Number',
    description: 'Allows numeric values input',
    editor: NumberValueEditor,
  };

  const slider: StandardEditorsRegistryItem<number> = {
    id: 'slider',
    name: 'Slider',
    description: 'Allows numeric values input',
    editor: SliderValueEditor,
  };

  const text: StandardEditorsRegistryItem<string> = {
    id: 'text',
    name: 'Text',
    description: 'Allows string values input',
    editor: StringValueEditor,
  };

  const strings: StandardEditorsRegistryItem<string[]> = {
    id: 'strings',
    name: 'String array',
    description: 'An array of strings',
    editor: StringArrayEditor,
  };

  const boolean: StandardEditorsRegistryItem<boolean> = {
    id: 'boolean',
    name: 'Boolean',
    description: 'Allows boolean values input',
    editor(props) {
      const { id, ...rest } = props; // Remove id from properties passed into switch
      return <Switch {...rest} onChange={(e) => props.onChange(e.currentTarget.checked)} />;
    },
  };

  const select: StandardEditorsRegistryItem = {
    id: 'select',
    name: 'Select',
    description: 'Allows option selection',
    editor: SelectValueEditor,
  };

  const multiSelect: StandardEditorsRegistryItem = {
    id: 'multi-select',
    name: 'Multi select',
    description: 'Allows for multiple option selection',
    editor: MultiSelectValueEditor,
  };

  const radio: StandardEditorsRegistryItem = {
    id: 'radio',
    name: 'Radio',
    description: 'Allows option selection',
    editor(props) {
      return <RadioButtonGroup {...props} options={props.item.settings?.options} />;
    },
  };

  const unit: StandardEditorsRegistryItem<string> = {
    id: 'unit',
    name: 'Unit',
    description: 'Allows unit input',
    editor: UnitValueEditor,
  };

  const color: StandardEditorsRegistryItem<string, ColorValueEditorSettings> = {
    id: 'color',
    name: 'Color',
    description: 'Allows color selection',
    editor(props) {
      return (
        <ColorValueEditor value={props.value} onChange={props.onChange} settings={props.item.settings} details={true} />
      );
    },
  };

  const fieldColor: StandardEditorsRegistryItem<FieldColor | undefined> = {
    id: 'fieldColor',
    name: 'Field Color',
    description: 'Field color selection',
    editor: FieldColorEditor,
  };

  const links: StandardEditorsRegistryItem<DataLink[]> = {
    id: 'links',
    name: 'Links',
    description: 'Allows defining data links',
    editor: DataLinksValueEditor,
  };

  const actions: StandardEditorsRegistryItem<Action[]> = {
    id: 'actions',
    name: 'Actions',
    description: 'Allows defining actions',
    editor: ActionsValueEditor,
  };

  const statsPicker: StandardEditorsRegistryItem<string[], StatsPickerConfigSettings> = {
    id: 'stats-picker',
    name: 'Stats Picker',
    editor: StatsPickerEditor,
    description: '',
  };

  const timeZone: StandardEditorsRegistryItem<TimeZone> = {
    id: 'timezone',
    name: 'Time zone',
    description: 'Time zone selection',
    editor: TimeZonePicker,
  };

  const fieldName: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
    id: 'field-name',
    name: 'Field name',
    description: 'Allows selecting a field name from a data frame',
    editor: FieldNamePicker,
  };

  const dashboardPicker: StandardEditorsRegistryItem<string, DashboardPickerOptions> = {
    id: 'dashboard-uid',
    name: 'Dashboard',
    description: 'Select dashboard',
    editor: DashboardPicker,
  };

  const mappings: StandardEditorsRegistryItem<ValueMapping[]> = {
    id: 'mappings',
    name: 'Mappings',
    description: 'Allows defining value mappings',
    editor: ValueMappingsEditor,
  };

  const thresholds: StandardEditorsRegistryItem<ThresholdsConfig> = {
    id: 'thresholds',
    name: 'Thresholds',
    description: 'Allows defining thresholds',
    editor: ThresholdsValueEditor,
  };

  return [
    text,
    number,
    slider,
    boolean,
    radio,
    select,
    unit,
    links,
    actions,
    statsPicker,
    strings,
    timeZone,
    fieldColor,
    color,
    multiSelect,
    fieldName,
    dashboardPicker,
    mappings,
    thresholds,
  ];
};

/**
 * Returns collection of common field config properties definitions
 */
export const getAllStandardFieldConfigs = () => {
  const category = ['Standard options'];
  const displayName: FieldConfigPropertyItem<FieldConfig, string, StringFieldConfigSettings> = {
    id: 'displayName',
    path: 'displayName',
    name: 'Display name',
    description: 'Change the field or series name',
    editor: standardEditorsRegistry.get('text').editor,
    override: standardEditorsRegistry.get('text').editor,
    process: displayNameOverrideProcessor,
    settings: {
      placeholder: 'none',
      expandTemplateVars: true,
    },
    shouldApply: () => true,
    category,
  };

  const unit: FieldConfigPropertyItem<FieldConfig, string, StringFieldConfigSettings> = {
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    description: '',

    editor: standardEditorsRegistry.get('unit').editor,
    override: standardEditorsRegistry.get('unit').editor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: 'none',
    },

    shouldApply: () => true,
    category,
  };

  const fieldMinMax: FieldConfigPropertyItem<FieldConfig, boolean, BooleanFieldSettings> = {
    id: 'fieldMinMax',
    path: 'fieldMinMax',
    name: 'Field min/max',
    description: 'Calculate min max per field',

    editor: standardEditorsRegistry.get('boolean').editor,
    override: standardEditorsRegistry.get('boolean').editor,
    process: booleanOverrideProcessor,

    shouldApply: (field) => field.type === FieldType.number,
    showIf: (options) => {
      return options.min === undefined || options.max === undefined;
    },
    category,
  };

  const min: FieldConfigPropertyItem<FieldConfig, number, NumberFieldConfigSettings> = {
    id: 'min',
    path: 'min',
    name: 'Min',
    description: 'Leave empty to calculate based on all values',

    editor: standardEditorsRegistry.get('number').editor,
    override: standardEditorsRegistry.get('number').editor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
    shouldApply: (field) => field.type === FieldType.number,
    category,
  };

  const max: FieldConfigPropertyItem<FieldConfig, number, NumberFieldConfigSettings> = {
    id: 'max',
    path: 'max',
    name: 'Max',
    description: 'Leave empty to calculate based on all values',

    editor: standardEditorsRegistry.get('number').editor,
    override: standardEditorsRegistry.get('number').editor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },

    shouldApply: (field) => field.type === FieldType.number,
    category,
  };

  const decimals: FieldConfigPropertyItem<FieldConfig, number, NumberFieldConfigSettings> = {
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',

    editor: standardEditorsRegistry.get('number').editor,
    override: standardEditorsRegistry.get('number').editor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
      min: 0,
      max: 15,
      integer: true,
    },

    shouldApply: (field) => field.type === FieldType.number,
    category,
  };

  const noValue: FieldConfigPropertyItem<FieldConfig, string, StringFieldConfigSettings> = {
    id: 'noValue',
    path: 'noValue',
    name: 'No value',
    description: 'What to show when there is no value',

    editor: standardEditorsRegistry.get('text').editor,
    override: standardEditorsRegistry.get('text').editor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: '-',
    },
    // ??? FieldConfig optionsUi with no value
    shouldApply: () => true,
    category,
  };

  const dataLinksCategory = 'Data links and actions';

  const links: FieldConfigPropertyItem<FieldConfig, DataLink[], DataLinksFieldConfigSettings> = {
    id: 'links',
    path: 'links',
    name: 'Data links',
    editor: standardEditorsRegistry.get('links').editor,
    override: standardEditorsRegistry.get('links').editor,
    process: dataLinksOverrideProcessor,
    settings: {
      showOneClick: false,
    },
    shouldApply: () => true,
    category: [dataLinksCategory],
    getItemsCount: (value) => (value ? value.length : 0),
  };

  const actions: FieldConfigPropertyItem<FieldConfig, Action[], DataLinksFieldConfigSettings> = {
    id: 'actions',
    path: 'actions',
    name: 'Actions',
    editor: standardEditorsRegistry.get('actions').editor,
    override: standardEditorsRegistry.get('actions').editor,
    process: actionsOverrideProcessor,
    settings: {
      showOneClick: false,
    },
    shouldApply: () => true,
    category: [dataLinksCategory],
    getItemsCount: (value) => (value ? value.length : 0),
    hideFromDefaults: true,
  };

  const color: FieldConfigPropertyItem<FieldConfig, FieldColor | undefined, FieldColorConfigSettings> = {
    id: 'color',
    path: 'color',
    name: 'Color scheme',
    editor: standardEditorsRegistry.get('fieldColor').editor,
    override: standardEditorsRegistry.get('fieldColor').editor,
    process: identityOverrideProcessor,
    shouldApply: () => true,
    settings: {
      byValueSupport: true,
      preferThresholdsMode: true,
    },
    category,
  };

  const mappings: FieldConfigPropertyItem<FieldConfig, ValueMapping[], ValueMappingFieldConfigSettings> = {
    id: 'mappings',
    path: 'mappings',
    name: 'Value mappings',
    description: 'Modify the display text based on input value',

    editor: standardEditorsRegistry.get('mappings').editor,
    override: standardEditorsRegistry.get('mappings').editor,
    process: valueMappingsOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: (x) => x.type !== FieldType.time,
    category: ['Value mappings'],
    getItemsCount: (value?) => (value ? value.length : 0),
  };

  const thresholds: FieldConfigPropertyItem<FieldConfig, ThresholdsConfig, ThresholdsFieldConfigSettings> = {
    id: 'thresholds',
    path: 'thresholds',
    name: 'Thresholds',
    editor: standardEditorsRegistry.get('thresholds').editor,
    override: standardEditorsRegistry.get('thresholds').editor,
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

  const filterable: FieldConfigPropertyItem<FieldConfig, boolean | undefined, {}> = {
    id: 'filterable',
    path: 'filterable',
    name: 'Ad-hoc filterable',
    hideFromDefaults: true,
    editor: standardEditorsRegistry.get('boolean').editor,
    override: standardEditorsRegistry.get('boolean').editor,
    process: booleanOverrideProcessor,
    shouldApply: () => true,
    settings: {},
    category,
  };

  return [
    unit,
    min,
    max,
    fieldMinMax,
    decimals,
    displayName,
    color,
    noValue,
    links,
    actions,
    mappings,
    thresholds,
    filterable,
  ];
};
