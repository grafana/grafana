// These are used in some other plugins for some reason

import {
  escapeStringForRegex,
  FieldOverrideContext,
  getFieldDisplayName,
  PanelOptionsEditorBuilder,
  ReducerID,
  standardEditorsRegistry,
  FieldDisplay,
  FieldConfigEditorBuilder,
  FieldType,
} from '@grafana/data';
import { SingleStatBaseOptions, VizOrientation } from '@grafana/schema';

import { PanelFieldConfig } from './panelcfg.gen';

export function addStandardDataReduceOptions<T extends SingleStatBaseOptions>(
  builder: PanelOptionsEditorBuilder<T>,
  includeFieldMatcher = true
) {
  const valueOptionsCategory = ['Value options'];

  builder.addRadio({
    path: 'reduceOptions.values',
    name: 'Show',
    description: 'Calculate a single value per column or series or show each row',
    settings: {
      options: [
        { value: false, label: 'Calculate' },
        { value: true, label: 'All values' },
      ],
    },
    category: valueOptionsCategory,
    defaultValue: false,
  });

  builder.addNumberInput({
    path: 'reduceOptions.limit',
    name: 'Limit',
    description: 'Max number of rows to display',
    category: valueOptionsCategory,
    settings: {
      placeholder: '25',
      integer: true,
      min: 1,
      max: 5000,
    },
    showIf: (options) => options.reduceOptions.values === true,
  });

  builder.addCustomEditor({
    id: 'reduceOptions.calcs',
    path: 'reduceOptions.calcs',
    name: 'Calculation',
    description: 'Choose a reducer function / calculation',
    category: valueOptionsCategory,
    editor: standardEditorsRegistry.get('stats-picker').editor,
    // TODO: Get ReducerID from generated schema one day?
    defaultValue: [ReducerID.lastNotNull],
    // Hides it when all values mode is on
    showIf: (currentConfig) => currentConfig.reduceOptions.values === false,
  });

  if (includeFieldMatcher) {
    builder.addSelect({
      path: 'reduceOptions.fields',
      name: 'Fields',
      description: 'Select the fields that should be included in the panel',
      category: valueOptionsCategory,
      settings: {
        allowCustomValue: true,
        options: [],
        getOptions: async (context: FieldOverrideContext) => {
          const options = [
            { value: '', label: 'Numeric Fields' },
            { value: '/.*/', label: 'All Fields' },
          ];
          if (context && context.data) {
            for (const frame of context.data) {
              for (const field of frame.fields) {
                const name = getFieldDisplayName(field, frame, context.data);
                const value = `/^${escapeStringForRegex(name)}$/`;
                options.push({ value, label: name });
              }
            }
          }
          return Promise.resolve(options);
        },
      },
      defaultValue: '',
    });
  }
}

export function addOrientationOption<T extends SingleStatBaseOptions>(
  builder: PanelOptionsEditorBuilder<T>,
  category?: string[]
) {
  builder.addRadio({
    path: 'orientation',
    name: 'Orientation',
    description: 'Layout orientation',
    category,
    settings: {
      options: [
        { value: VizOrientation.Auto, label: 'Auto' },
        { value: VizOrientation.Horizontal, label: 'Horizontal' },
        { value: VizOrientation.Vertical, label: 'Vertical' },
      ],
    },
    defaultValue: VizOrientation.Auto,
  });
}

export function formatDisplayValuesWithCustomUnits(
  fieldValues: FieldDisplay[],
  config: PanelFieldConfig
): FieldDisplay[] {
  const { prefix, suffix } = config;

  if (!prefix && !suffix) {
    return fieldValues;
  }

  return fieldValues.map((fieldValue) => {
    const fieldType = fieldValue?.sourceField?.type;
    // Test for FieldType.number, since that is the only type on which formatting is enforced
    if (fieldType === FieldType.number) {
      const { display } = fieldValue;
      return {
        ...fieldValue,
        display: {
          ...display,
          prefix: `${prefix}${display.prefix ?? ''}`,
          suffix: `${display.suffix ?? ''}${suffix}`,
        },
      };
    }
    return fieldValue;
  });
}

export function addCustomUnitTextInputs(builder: FieldConfigEditorBuilder<PanelFieldConfig>) {
  const category = ['Custom units'];
  return builder
    .addTextInput({
      path: 'prefix',
      name: 'Prefix',
      defaultValue: '',
      settings: {
        placeholder: 'Enter custom prefix',
      },
      category,
    })
    .addTextInput({
      path: 'suffix',
      name: 'Suffix',
      defaultValue: '',
      settings: {
        placeholder: 'Enter custom suffix',
      },
      category,
    });
}
