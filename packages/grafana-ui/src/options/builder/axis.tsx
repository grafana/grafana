import React from 'react';
import {
  FieldConfigEditorBuilder,
  FieldOverrideEditorProps,
  FieldType,
  identityOverrideProcessor,
  SelectableValue,
} from '@grafana/data';
import {
  AxisConfig,
  AxisPlacement,
  graphFieldOptions,
  ScaleDistributionConfig,
  Select,
  HorizontalGroup,
  RadioButtonGroup,
} from '../../index';
import { ScaleDistribution } from '../../components/uPlot/models.gen';

/**
 * @alpha
 */
export function addAxisConfig(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  defaultConfig: AxisConfig,
  hideScale?: boolean
) {
  builder
    .addRadio({
      path: 'axisPlacement',
      name: 'Placement',
      category: ['Axis'],
      defaultValue: graphFieldOptions.axisPlacement[0].value,
      settings: {
        options: graphFieldOptions.axisPlacement,
      },
    })
    .addTextInput({
      path: 'axisLabel',
      name: 'Label',
      category: ['Axis'],
      defaultValue: '',
      settings: {
        placeholder: 'Optional text',
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
      // no matter what the field type is
      shouldApply: () => true,
    })
    .addNumberInput({
      path: 'axisWidth',
      name: 'Width',
      category: ['Axis'],
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addNumberInput({
      path: 'axisSoftMin',
      name: 'Soft min',
      defaultValue: defaultConfig.axisSoftMin,
      category: ['Axis'],
      settings: {
        placeholder: 'See: Standard options > Min',
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      name: 'Soft max',
      defaultValue: defaultConfig.axisSoftMax,
      category: ['Axis'],
      settings: {
        placeholder: 'See: Standard options > Max',
      },
    });
  if (!hideScale) {
    builder.addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      name: 'Scale',
      category: ['Axis'],
      editor: ScaleDistributionEditor,
      override: ScaleDistributionEditor,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    });
  }
}

const DISTRIBUTION_OPTIONS: Array<SelectableValue<ScaleDistribution>> = [
  {
    label: 'Linear',
    value: ScaleDistribution.Linear,
  },
  {
    label: 'Logarithmic',
    value: ScaleDistribution.Log,
  },
];

const LOG_DISTRIBUTION_OPTIONS: Array<SelectableValue<number>> = [
  {
    label: '2',
    value: 2,
  },
  {
    label: '10',
    value: 10,
  },
];

/**
 * @alpha
 */
const ScaleDistributionEditor: React.FC<FieldOverrideEditorProps<ScaleDistributionConfig, any>> = ({
  value,
  onChange,
}) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value.type || ScaleDistribution.Linear}
        options={DISTRIBUTION_OPTIONS}
        onChange={(v) => {
          console.log(v, value);
          onChange({
            ...value,
            type: v!,
            log: v === ScaleDistribution.Linear ? undefined : 2,
          });
        }}
      />
      {value.type === ScaleDistribution.Log && (
        <Select
          menuShouldPortal
          allowCustomValue={false}
          autoFocus
          options={LOG_DISTRIBUTION_OPTIONS}
          value={value.log || 2}
          prefix={'base'}
          width={12}
          onChange={(v) => {
            onChange({
              ...value,
              log: v.value!,
            });
          }}
        />
      )}
    </HorizontalGroup>
  );
};
