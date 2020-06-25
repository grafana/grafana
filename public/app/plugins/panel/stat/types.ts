import {
  SingleStatBaseOptions,
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
} from '@grafana/ui';
import {
  ReducerID,
  standardEditorsRegistry,
  FieldOverrideContext,
  getFieldDisplayName,
  escapeStringForRegex,
} from '@grafana/data';
import { PanelOptionsEditorBuilder } from '@grafana/data';

// Structure copied from angular
export interface StatPanelOptions extends SingleStatBaseOptions {
  graphMode: BigValueGraphMode;
  colorMode: BigValueColorMode;
  justifyMode: BigValueJustifyMode;
  textMode: BigValueTextMode;
}

export function addStandardDataReduceOptions(
  builder: PanelOptionsEditorBuilder<SingleStatBaseOptions>,
  includeOrientation = true,
  includeFieldMatcher = true
) {
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
    defaultValue: false,
  });

  builder.addNumberInput({
    path: 'reduceOptions.limit',
    name: 'Limit',
    description: 'Max number of rows to display',
    settings: {
      placeholder: '5000',
      integer: true,
      min: 1,
      max: 5000,
    },
    showIf: options => options.reduceOptions.values === true,
  });

  builder.addCustomEditor({
    id: 'reduceOptions.calcs',
    path: 'reduceOptions.calcs',
    name: 'Calculation',
    description: 'Choose a reducer function / calculation',
    editor: standardEditorsRegistry.get('stats-picker').editor as any,
    defaultValue: [ReducerID.mean],
    // Hides it when all values mode is on
    showIf: currentConfig => currentConfig.reduceOptions.values === false,
  });

  if (includeFieldMatcher) {
    builder.addSelect({
      path: 'reduceOptions.fields',
      name: 'Fields',
      description: 'Select the fields that should be included in the panel',
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

  if (includeOrientation) {
    builder.addRadio({
      path: 'orientation',
      name: 'Orientation',
      description: 'Stacking direction in case of multiple series or fields',
      settings: {
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ],
      },
      defaultValue: 'auto',
    });
  }
}
