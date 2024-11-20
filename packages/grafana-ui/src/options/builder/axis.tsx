import {
  FieldConfigEditorBuilder,
  FieldType,
  identityOverrideProcessor,
  SelectableValue,
  StandardEditorProps,
} from '@grafana/data';
import { AxisColorMode, AxisConfig, AxisPlacement, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';

import { Field } from '../../components/Forms/Field';
import { RadioButtonGroup } from '../../components/Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../../components/Input/Input';
import { Stack } from '../../components/Layout/Stack/Stack';
import { Select } from '../../components/Select/Select';
import { graphFieldOptions } from '../../components/uPlot/config';

/**
 * @alpha
 */
export function addAxisConfig(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  defaultConfig: AxisConfig,
  hideScale?: boolean
) {
  const category = ['Axis'];

  // options for axis appearance
  builder
    .addRadio({
      path: 'axisPlacement',
      name: 'Placement',
      category,
      defaultValue: graphFieldOptions.axisPlacement[0].value,
      settings: {
        options: graphFieldOptions.axisPlacement,
      },
    })
    .addTextInput({
      path: 'axisLabel',
      name: 'Label',
      category,
      defaultValue: '',
      settings: {
        placeholder: 'Optional text',
        expandTemplateVars: true,
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
      // Do not apply default settings to time and string fields which are used as x-axis fields in Time series and Bar chart panels
      shouldApply: (f) => f.type !== FieldType.time && f.type !== FieldType.string,
    })
    .addNumberInput({
      path: 'axisWidth',
      name: 'Width',
      category,
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addRadio({
      path: 'axisGridShow',
      name: 'Show grid lines',
      category,
      defaultValue: undefined,
      settings: {
        options: [
          { value: undefined, label: 'Auto' },
          { value: true, label: 'On' },
          { value: false, label: 'Off' },
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addRadio({
      path: 'axisColorMode',
      name: 'Color',
      category,
      defaultValue: AxisColorMode.Text,
      settings: {
        options: [
          { value: AxisColorMode.Text, label: 'Text' },
          { value: AxisColorMode.Series, label: 'Series' },
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addBooleanSwitch({
      path: 'axisBorderShow',
      name: 'Show border',
      category,
      defaultValue: false,
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    });

  // options for scale range
  builder
    .addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      name: 'Scale',
      category,
      editor: ScaleDistributionEditor,
      override: ScaleDistributionEditor,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    })
    .addBooleanSwitch({
      path: 'axisCenteredZero',
      name: 'Centered zero',
      category,
      defaultValue: false,
      showIf: (c) => c.scaleDistribution?.type !== ScaleDistribution.Log,
    })
    .addNumberInput({
      path: 'axisSoftMin',
      name: 'Soft min',
      defaultValue: defaultConfig.axisSoftMin,
      category,
      settings: {
        placeholder: 'See: Standard options > Min',
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      name: 'Soft max',
      defaultValue: defaultConfig.axisSoftMax,
      category,
      settings: {
        placeholder: 'See: Standard options > Max',
      },
    });
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
  {
    label: 'Symlog',
    value: ScaleDistribution.Symlog,
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
 * @internal
 */
export const ScaleDistributionEditor = ({ value, onChange }: StandardEditorProps<ScaleDistributionConfig>) => {
  const type = value?.type ?? ScaleDistribution.Linear;
  const log = value?.log ?? 2;

  return (
    <Stack direction="column" gap={2}>
      <RadioButtonGroup
        value={type}
        options={DISTRIBUTION_OPTIONS}
        onChange={(v) => {
          onChange({
            ...value,
            type: v!,
            log: v === ScaleDistribution.Linear ? undefined : log,
          });
        }}
      />
      {(type === ScaleDistribution.Log || type === ScaleDistribution.Symlog) && (
        <Field label="Log base">
          <Select
            options={LOG_DISTRIBUTION_OPTIONS}
            value={log}
            onChange={(v) => {
              onChange({
                ...value,
                log: v.value!,
              });
            }}
          />
        </Field>
      )}
      {type === ScaleDistribution.Symlog && (
        <Field label="Linear threshold" style={{ marginBottom: 0 }}>
          <Input
            placeholder="1"
            value={value?.linearThreshold}
            onChange={(v) => {
              onChange({
                ...value,
                linearThreshold: Number(v.currentTarget.value),
              });
            }}
          />
        </Field>
      )}
    </Stack>
  );
};
