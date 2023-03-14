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

/**
 * This function prepends/appends custom prefixes/suffixes to a `BigValue` display value
 * NOTE: this will prepend/append to any already-chosen `Units` from the `Standard Options` field config
 *
 * @example
 * config.prefix: `^`
 * config.suffix: `*`
 * fieldValues[0].display.text: `23%`
 *
 * New custom display final output -> `^23%*`
 *
 * @param fieldValues - An array of `FieldDisplay` objects
 * @param config - The `PanelFieldConfig` options, which consist of a custom `prefix` and/or `suffix`
 * @returns An updated array of `FieldDisplay` objects with new custom `fieldValue.display` values
 */
export function formatDisplayValuesWithCustomUnits(
  fieldValues: FieldDisplay[],
  config: PanelFieldConfig
): FieldDisplay[] {
  const { prefix, suffix } = config;

  // No custom values? This will skip any updates both for empty strings (the default ui fill-in values),
  // as well as `undefined` (the value if a custom prefix/suffix is chosen, then removed in the ui)
  if (!prefix && !suffix) {
    return fieldValues;
  }

  return fieldValues.map((fieldValue) => {
    const fieldType = fieldValue?.sourceField?.type;
    // Test for FieldType.number, since that is the only type on which formatting is enforced
    if (fieldType === FieldType.number) {
      const { display } = fieldValue;

      // Test for nullishness here, otherwise the substring "undefined" will be concatenated into the string
      const customPrefix = `${prefix ?? ''}${display.prefix ?? ''}`;
      const customSuffix = `${display.suffix ?? ''}${suffix ?? ''}`;

      return {
        ...fieldValue,
        display: {
          ...display,
          prefix: customPrefix,
          suffix: customSuffix,
        },
      };
    }
    return fieldValue;
  });
}

/**
 * This function builds two text inputs for the `FieldConfigEditorBuilder`;
 * these inputs will add custom prefixes and suffixes to `BigValue` values
 *
 * @param builder - The `FieldConfigEditorBuilder<PanelFieldConfig>` on which to add the two text inputs
 * @returns A prefix and suffix text input
 */
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
