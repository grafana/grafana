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
  VizOrientation,
  ValueMapping,
  MappingType,
  Threshold,
  SingleStatValueOptions,
} from '@grafana/ui';

import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import * as yup from 'yup';

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

const valueMappingSchema: yup.ObjectSchema<ValueMapping> = yup.object({
  from: yup.string(),
  to: yup.string(),
  id: yup.number(),
  operator: yup.string(),
  text: yup.string(),
  type: yup.number().oneOf([MappingType.ValueToText, MappingType.RangeToText]),
});
const thresholdSchema: yup.ObjectSchema<Threshold> = yup.object({
  index: yup.number(),
  value: yup.number(),
  color: yup.string(),
});

const valueOptionsYupSchema: yup.ObjectSchema<SingleStatValueOptions> = yup.object({
  unit: yup.string(),
  suffix: yup.string(),
  stat: yup.string(),
  prefix: yup.string(),
  decimals: yup.number().nullable(),
});

const GaugeOptionsSchema: yup.ObjectSchema<GaugeOptions> = yup.object({
  minValue: yup.number().required(),
  maxValue: yup.number().required(),
  showThresholdMarkers: yup.boolean(),
  showThresholdLabels: yup.boolean(),
  orientation: yup.mixed().oneOf([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical]),
  thresholds: yup.array().of(thresholdSchema),
  valueMappings: yup.array().of(valueMappingSchema),
  valueOptions: valueOptionsYupSchema,
});

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor(optionsModel)
  .setOptionsSchema(GaugeOptionsSchema)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
