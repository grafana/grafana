// These are used in some other plugins for some reason

import {
  escapeStringForRegex,
  FieldOverrideContext,
  getFieldDisplayName,
  PanelOptionsEditorBuilder,
  ReducerID,
  standardEditorsRegistry,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { SingleStatBaseOptions, VizOrientation } from '@grafana/schema';

export function addStandardDataReduceOptions<T extends SingleStatBaseOptions>(
  builder: PanelOptionsEditorBuilder<T>,
  includeFieldMatcher = true
) {
  const valueOptionsCategory = [t('stat.add-standard-data-reduce-options.category-value-options', 'Value options')];

  builder.addRadio({
    path: 'reduceOptions.values',
    name: t('stat.add-standard-data-reduce-options.name-show', 'Show'),
    description: t(
      'stat.add-standard-data-reduce-options.description-show',
      'Calculate a single value per column or series or show each row'
    ),
    settings: {
      options: [
        { value: false, label: t('stat.add-standard-data-reduce-options.show-options.label-calculate', 'Calculate') },
        { value: true, label: t('stat.add-standard-data-reduce-options.show-options.label-all-values', 'All values') },
      ],
    },
    category: valueOptionsCategory,
    defaultValue: false,
  });

  builder.addNumberInput({
    path: 'reduceOptions.limit',
    name: t('stat.add-standard-data-reduce-options.name-limit', 'Limit'),
    description: t('stat.add-standard-data-reduce-options.description-limit', 'Max number of rows to display'),
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
    name: t('stat.add-standard-data-reduce-options.name-calculation', 'Calculation'),
    description: t(
      'stat.add-standard-data-reduce-options.description-calculation',
      'Choose a reducer function / calculation'
    ),
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
      name: t('stat.add-standard-data-reduce-options.name-fields', 'Fields'),
      description: t(
        'stat.add-standard-data-reduce-options.description-fields',
        'Select the fields that should be included in the panel'
      ),
      category: valueOptionsCategory,
      settings: {
        allowCustomValue: true,
        options: [],
        getOptions: async (context: FieldOverrideContext) => {
          const options = [
            {
              value: '',
              label: t('stat.add-standard-data-reduce-options.fields-options.label-numeric-fields', 'Numeric Fields'),
            },
            {
              value: '/.*/',
              label: t('stat.add-standard-data-reduce-options.fields-options.label-all-fields', 'All Fields'),
            },
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
    name: t('stat.add-orientation-option.name-orientation', 'Orientation'),
    description: t('stat.add-orientation-option.description-orientation', 'Layout orientation'),
    category,
    settings: {
      options: [
        { value: VizOrientation.Auto, label: t('stat.add-orientation-option.orientation-options.label-auto', 'Auto') },
        {
          value: VizOrientation.Horizontal,
          label: t('stat.add-orientation-option.orientation-options.label-horizontal', 'Horizontal'),
        },
        {
          value: VizOrientation.Vertical,
          label: t('stat.add-orientation-option.orientation-options.label-vertical', 'Vertical'),
        },
      ],
    },
    defaultValue: VizOrientation.Auto,
  });
}
