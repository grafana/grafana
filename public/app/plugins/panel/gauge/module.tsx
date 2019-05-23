import {
  PanelPlugin,
  sharedSingleStatMigrationCheck,
  sharedSingleStatOptionsCheck,
  VizOrientation,
  ValueMapping,
  MappingType,
  Threshold,
  FieldDisplayEditor,
  FieldDisplayOptions,
  Field,
  FieldType,
  FieldPropertiesEditor,
  OptionsGroupUIBuilder,
} from '@grafana/ui';

import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import * as yup from 'yup';

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

const fieldSchema: yup.ObjectSchema<Partial<Field>> = yup.object({
  name: yup.string(), // The column name
  title: yup.string(), // The display value for this field.  This supports template variables blank is auto
  type: yup.mixed().oneOf([FieldType.boolean, FieldType.number, FieldType.other, FieldType.string, FieldType.time]),
  filterable: yup.boolean(),
  unit: yup.string(),
  dateFormat: yup.string(), // Source data format
  decimals: yup.number().nullable(),
  color: yup.string(),
  min: yup.number().nullable(),
  max: yup.number().nullable(),
});

const fieldOptionsSchema: yup.ObjectSchema<FieldDisplayOptions> = yup.object({
  defaults: fieldSchema,
  override: fieldSchema,
  calcs: yup.array().of(yup.string()),
  thresholds: yup.array().of(thresholdSchema),
  mappings: yup.array().of(valueMappingSchema),
});

const GaugeOptionsSchema: yup.ObjectSchema<GaugeOptions> = yup.object({
  showThresholdMarkers: yup.boolean(),
  showThresholdLabels: yup.boolean(),
  orientation: yup.mixed().oneOf([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical]),
  fieldOptions: fieldOptionsSchema,
});

const schema = new OptionsGroupUIBuilder<GaugeOptions>()
  .addPanelOptionsGrid()
  .addPanelOptionsGroup('Display')
  .addBooleanEditor('showThresholdLabels', {
    label: 'Labels',
  })
  .addBooleanEditor('showThresholdMarkers', {
    label: 'Markers',
  })
  .addOptionEditor('fieldOptions', FieldDisplayEditor, {
    labelWidth: 6,
  })
  .endGroup()
  .addPanelOptionsGroup('Field')
  .addScopedOptions('fieldOptions', {})
  .addOptionEditor('defaults', FieldPropertiesEditor, {
    showMinMax: true,
  })
  .endGroup()
  .endGroup()
  .addPanelOptionsGroup('Thresholds')
  .addScopedOptions('fieldOptions', {})
  .addThresholdsEditor('thresholds')
  .endGroup()
  .endGroup()
  .endGroup()
  .getUIModel();

export const plugin = new PanelPlugin<GaugeOptions>(GaugePanel)
  .setDefaults(defaults)
  .setEditor({ model: schema })
  .setOptionsSchema(GaugeOptionsSchema)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck)
  .setMigrationHandler(sharedSingleStatMigrationCheck);
