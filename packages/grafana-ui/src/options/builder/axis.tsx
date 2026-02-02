import { t } from 'i18next';

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
export function addAxisConfig(builder: FieldConfigEditorBuilder<AxisConfig>, defaultConfig: AxisConfig) {
  // BMC Change: To enable localization for below text
  const category = [t('bmcgrafana.dashboards.edit-panel.axis.text', 'Axis')];
  // BMC Change ends

  // options for axis appearance
  addAxisPlacement(builder);


  builder.addTextInput({
    path: 'axisLabel',
    // BMC Change: To enable localization for below text
    name: t('bmcgrafana.dashboards.edit-panel.axis.label-text', 'Label'),
    // BMC Change ends
    category,
    defaultValue: '',
    settings: {
      // BMC Change: To enable localization for below text
      placeholder: t('bmcgrafana.dashboards.edit-panel.axis.label-placeholder', 'Optional text'),
      // BMC Change ends
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
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.grid-lines-text', 'Show grid lines'),
      // BMC Change ends
      category,
      defaultValue: undefined,
      settings: {
        options: [
          // BMC Change: To enable localization for below text
          { value: undefined, label: t('bmcgrafana.dashboards.edit-panel.axis.grid-lines.auto-text', 'Auto') },
          { value: true, label: t('bmcgrafana.dashboards.edit-panel.axis.grid-lines.on-text', 'On') },
          { value: false, label: t('bmcgrafana.dashboards.edit-panel.axis.grid-lines.off-text', 'Off') },
          // BMC Change ends
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addRadio({
      path: 'axisColorMode',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.color-text', 'Color'),
      // BMC Change ends
      category,
      defaultValue: AxisColorMode.Text,
      settings: {
        options: [
          // BMC Change: To enable localization for below text
          { value: AxisColorMode.Text, label: t('bmcgrafana.dashboards.edit-panel.axis.color.text-text', 'Text') },
          {
            value: AxisColorMode.Series,
            label: t('bmcgrafana.dashboards.edit-panel.axis.color.series-text', 'Series'),
          },
          // BMC Change ends
        ],
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addBooleanSwitch({
      path: 'axisBorderShow',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.show-border-text', 'Show border'),
      // BMC Change ends
      category,
      defaultValue: false,
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    });

  // options for scale range
  builder
    .addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.scale-text', 'Scale'),
      // BMC Change ends
      category,
      editor: ScaleDistributionEditor,
      override: ScaleDistributionEditor,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    })
    .addBooleanSwitch({
      path: 'axisCenteredZero',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.centered-zero-text', 'Centered zero'),
      // BMC Change ends
      category,
      defaultValue: false,
      showIf: (c) => c.scaleDistribution?.type !== ScaleDistribution.Log,
    })
    .addNumberInput({
      path: 'axisSoftMin',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.soft-min-text', 'Soft min'),
      // BMC Change ends
      defaultValue: defaultConfig.axisSoftMin,
      category,
      settings: {
        // BMC Change: To enable localization for below text
        placeholder: t('bmcgrafana.dashboards.edit-panel.axis.soft-min-placeholder', 'See: Standard options > Min'),
        // BMC Change ends
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      // BMC Change: To enable localization for below text
      name: t('bmcgrafana.dashboards.edit-panel.axis.soft-max-text', 'Soft max'),
      // BMC Change ends
      defaultValue: defaultConfig.axisSoftMax,
      category,
      settings: {
        // BMC Change: To enable localization for below text
        placeholder: t('bmcgrafana.dashboards.edit-panel.axis.soft-max-description', 'See: Standard options > Max'),
        // BMC Change ends
      },
    });
}
// BMC Change: Function to enable localization for below text
export const getDISTRIBUTION_OPTIONS = (): Array<SelectableValue<ScaleDistribution>> => {
  return [
    {
      label: t('bmcgrafana.dashboards.edit-panel.axis.scale.linear-text', 'Linear'),
      value: ScaleDistribution.Linear,
    },
    {
      label: t('bmcgrafana.dashboards.edit-panel.axis.scale.Logarithmic-text', 'Logarithmic'),
      value: ScaleDistribution.Log,
    },
    {
      label: t('bmcgrafana.dashboards.edit-panel.axis.scale.Symlog-text', 'Symlog'),
      value: ScaleDistribution.Symlog,
    },
  ];
};
// BMC change ends
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
        // BMC Change: Function call for localized text
        options={getDISTRIBUTION_OPTIONS()}
        // BMC Change ends
        onChange={(v) => {
          onChange({
            ...value,
            type: v!,
            log: v === ScaleDistribution.Linear ? undefined : log,
          });
        }}
      />
      {(type === ScaleDistribution.Log || type === ScaleDistribution.Symlog) && (
        // BMC Change: To enable localization for below text
        <Field label={t('bmcgrafana.dashboards.edit-panel.axis.scale.logarithmic.log-base-text', 'Log base')}>
          {/* BMC Change ends */}
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
        // BMC Change: To enable localization for below text
        <Field
          label={t('bmcgrafana.dashboards.edit-panel.axis.scale.symlog.linear-threshold-text', 'Linear threshold')}
          style={{ marginBottom: 0 }}
        >
          <Input
            placeholder={t('bmcgrafana.dashboards.edit-panel.axis.scale.symlog.linear-threshold-placeholder', '1')}
            // BMC Change ends
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
  // BMC Change: To enable localization for below text
  const category = [t('bmcgrafana.dashboards.edit-panel.axis.text', 'Axis')];
  // BMC Change ends

  builder.addNumberInput({
    path: 'axisWidth',
    // BMC Change: To enable localization for below text
    name: t('bmcgrafana.dashboards.edit-panel.axis.width-text', 'Width'),
    // BMC Change ends
    category,
    settings: {
      // BMC Change: To enable localization for below text
      placeholder: t('bmcgrafana.dashboards.edit-panel.axis.width-placeholder', 'Auto'),
      // BMC Change ends
    },
    showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
  });
}

/** @internal */
export function addAxisPlacement(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  optionsFilter = (placement: AxisPlacement) => true
) {
  // BMC Change: To enable localization for below text
  const category = [t('bmcgrafana.dashboards.edit-panel.axis.text', 'Axis')];
  // BMC Change ends
  
  builder.addRadio({
    path: 'axisPlacement',
    // BMC Change: To enable localization for below text
    name: t('bmcgrafana.dashboards.edit-panel.axis.placement-text', 'Placement'),
    // BMC Change ends
    category,
    defaultValue: graphFieldOptions.axisPlacement[0].value,
    settings: {
      options: graphFieldOptions.axisPlacement.filter((placement) => optionsFilter(placement.value!)),
    },
  });
}
