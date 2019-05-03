import {
  PanelPlugin,
  sharedSingleStatMigrationCheck,
  sharedSingleStatOptionsCheck,
  OptionType,
  SingleStatValueEditor,
  ThresholdsEditor,
  IntegerOption,
  OptionsUIType,
  OptionsUIModel,
  PanelOptionsGroup,
  OptionEditor,
  OptionsPanelGroup,
  OptionsGrid,
  ObjectOptionDataSchema,
  SingleStatBaseOptions,
  OptionsDataSchema,
} from '@grafana/ui';

import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

const optionsModel: OptionsUIModel<GaugeOptions> = {
  model: {
    type: OptionsUIType.Layout,
    config: {
      columns: 1,
    },
    content: [
      {
        type: OptionsUIType.Layout,
        config: { columns: 3 },
        content: [
          {
            type: OptionsUIType.Group,
            config: { title: 'Thresholds' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Object,
                  component: ThresholdsEditor,
                  property: 'thresholds',
                },
              } as OptionEditor<GaugeOptions, 'thresholds'>,
            ],
          } as OptionsPanelGroup,
          {
            type: OptionsUIType.Group,
            config: { title: 'Value settings' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Object,
                  component: SingleStatValueEditor,
                  property: 'valueOptions',
                },
              } as OptionEditor<GaugeOptions, 'valueOptions'>,
            ],
          } as OptionsPanelGroup,
          {
            type: OptionsUIType.Group,
            config: { title: 'Gauge' },
            component: PanelOptionsGroup,
            content: [
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Number,
                  component: IntegerOption,
                  property: 'minValue',
                  label: 'Min value',
                },
              } as OptionEditor<GaugeOptions, 'minValue'>,
              {
                type: OptionsUIType.Editor,
                editor: {
                  optionType: OptionType.Number,
                  component: IntegerOption,
                  property: 'maxValue',
                  label: 'Max value',
                },
              } as OptionEditor<GaugeOptions, 'maxValue'>,
            ],
          } as OptionsPanelGroup,
        ],
      } as OptionsGrid,
    ],
  } as OptionsGrid,
};

const valueOptionsSchema: ObjectOptionDataSchema<SingleStatBaseOptions> = {
  properties: {
    orientation: {},
    thresholds: {},
    valueMappings: {},
    valueOptions: {},
  },
};

const optionsSchema: OptionsDataSchema<GaugeOptions> = {
  title: 'GaugeOptions',
  type: 'object',
  required: ['minValue', 'maxValue'],
  properties: {
    minValue: {
      type: 'number',
      description: 'Hint for min value...',
    },
    maxValue: {
      type: 'number',
      description: 'Hint for min value...',
    },
    showThresholdMarkers: {
      type: 'boolean',
    },
    showThresholdLabels: {
      type: 'boolean',
    },
    ...valueOptionsSchema.properties,
  },
};

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(optionsModel)
  .setOptionsSchema(optionsSchema)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
