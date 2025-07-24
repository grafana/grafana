import {
  FieldConfigEditorBuilder,
  FieldType,
  identityOverrideProcessor,
  SelectableValue,
  StandardEditorProps,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { AxisColorMode, AxisConfig, AxisPlacement, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';

import { Field } from '../../components/Forms/Field';
import { RadioButtonGroup } from '../../components/Forms/RadioButtonGroup/RadioButtonGroup';
import { Input } from '../../components/Input/Input';
import { Stack } from '../../components/Layout/Stack/Stack';
import { Select } from '../../components/Select/Select';
import { getGraphFieldOptions } from '../../components/uPlot/config';

/**
 * @alpha
 */
export function addAxisConfig(builder: FieldConfigEditorBuilder<AxisConfig>, defaultConfig: AxisConfig) {
  // options for axis appearance
  addAxisPlacement(builder);
  const category = [t('grafana-ui.builder.axis.category-axis', 'Axis')];

  builder.addTextInput({
    path: 'axisLabel',
    name: t('grafana-ui.builder.axis.name-label', 'Label'),
    category,
    defaultValue: '',
    settings: {
      placeholder: t('grafana-ui.builder.axis.placeholder-label', 'Optional text'),
      expandTemplateVars: true,
    },
    showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    // Do not apply default settings to time and string fields which are used as x-axis fields in Time series and Bar chart panels
    shouldApply: (f) => f.type !== FieldType.time && f.type !== FieldType.string,
  });

  addAxisWidth(builder);

  builder
    .addRadio({
      path: 'axisGridShow',
      name: t('grafana-ui.builder.axis.name-grid-lines', 'Show grid lines'),
      category,
      defaultValue: undefined,
      settings: {
        options: [
          { value: undefined, label: t('grafana-ui.builder.axis.grid-line-options.label-auto', 'Auto') },
          { value: true, label: t('grafana-ui.builder.axis.grid-line-options.label-on', 'On') },
          { value: false, label: t('grafana-ui.builder.axis.grid-line-options.label-off', 'Off') },
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addRadio({
      path: 'axisColorMode',
      name: t('grafana-ui.builder.axis.color-label', 'Color'),
      category,
      defaultValue: AxisColorMode.Text,
      settings: {
        options: [
          { value: AxisColorMode.Text, label: t('grafana-ui.builder.axis.color-options.label-text', 'Text') },
          { value: AxisColorMode.Series, label: t('grafana-ui.builder.axis.color-options.label-series', 'Series') },
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addBooleanSwitch({
      path: 'axisBorderShow',
      name: t('grafana-ui.builder.axis.name-show-border', 'Show border'),
      category,
      defaultValue: false,
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    });

  // options for scale range
  builder
    .addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      name: t('grafana-ui.builder.axis.name-scale', 'Scale'),
      category,
      editor: ScaleDistributionEditor,
      override: ScaleDistributionEditor,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    })
    .addBooleanSwitch({
      path: 'axisCenteredZero',
      name: t('grafana-ui.builder.axis.name-centered-zero', 'Centered zero'),
      category,
      defaultValue: false,
      showIf: (c) => c.scaleDistribution?.type !== ScaleDistribution.Log,
    })
    .addNumberInput({
      path: 'axisSoftMin',
      name: t('grafana-ui.builder.axis.name-soft-min', 'Soft min'),
      defaultValue: defaultConfig.axisSoftMin,
      category,
      settings: {
        placeholder: t('grafana-ui.builder.axis.placeholder-soft-min', 'See: Standard options > Min'),
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      name: t('grafana-ui.builder.axis.name-soft-max', 'Soft max'),
      defaultValue: defaultConfig.axisSoftMax,
      category,
      settings: {
        placeholder: t('grafana-ui.builder.axis.placeholder-soft-max', 'See: Standard options > Max'),
      },
    });
}

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
  const DISTRIBUTION_OPTIONS: Array<SelectableValue<ScaleDistribution>> = [
    {
      label: t('grafana-ui.builder.axis.scale-distribution-editor.distribution-options.label-linear', 'Linear'),
      value: ScaleDistribution.Linear,
    },
    {
      label: t('grafana-ui.builder.axis.scale-distribution-editor.distribution-options.label-log', 'Logarithmic'),
      value: ScaleDistribution.Log,
    },
    {
      label: t('grafana-ui.builder.axis.scale-distribution-editor.distribution-options.label-symlog', 'Symlog'),
      value: ScaleDistribution.Symlog,
    },
  ];

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
        <Field label={t('grafana-ui.axis-builder.log-base', 'Log base')}>
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
        <Field label={t('grafana-ui.axis-builder.linear-threshold', 'Linear threshold')} style={{ marginBottom: 0 }}>
          <Input
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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

/** @internal */
export function addAxisWidth(builder: FieldConfigEditorBuilder<AxisConfig>) {
  builder.addNumberInput({
    path: 'axisWidth',
    name: t('grafana-ui.builder.axis.name-width', 'Width'),
    category: [t('grafana-ui.builder.axis.category-axis', 'Axis')],
    settings: {
      placeholder: t('grafana-ui.builder.axis.placeholder-width', 'Auto'),
    },
    showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
  });
}

/** @internal */
export function addAxisPlacement(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  optionsFilter = (placement: AxisPlacement) => true
) {
  const graphFieldOptions = getGraphFieldOptions();
  builder.addRadio({
    path: 'axisPlacement',
    name: t('grafana-ui.builder.axis.name-placement', 'Placement'),
    category: [t('grafana-ui.builder.axis.category-axis', 'Axis')],
    defaultValue: graphFieldOptions.axisPlacement[0].value,
    settings: {
      options: graphFieldOptions.axisPlacement.filter((placement) => optionsFilter(placement.value!)),
    },
  });
}
