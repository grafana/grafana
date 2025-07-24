import { ReducerID, SelectableValue } from '@grafana/data';
import {
  CalculateFieldMode,
  WindowAlignment,
  CalculateFieldTransformerOptions,
  WindowOptions,
  WindowSizeMode,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, RadioButtonGroup, Select, StatsPicker } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';

import { LABEL_WIDTH } from './constants';

export const WindowOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, names, onChange } = props;
  const { window } = options;
  const selectOptions = names.map((v) => ({ label: v, value: v }));
  const typeOptions = [
    {
      label: t('transformers.window-options-editor.type-options.label.trailing', 'Trailing'),
      value: WindowAlignment.Trailing,
    },
    {
      label: t('transformers.window-options-editor.type-options.label.centered', 'Centered'),
      value: WindowAlignment.Centered,
    },
  ];
  const windowSizeModeOptions = [
    {
      label: t('transformers.window-options-editor.window-size-mode-options.label.percentage', 'Percentage'),
      value: WindowSizeMode.Percentage,
    },
    {
      label: t('transformers.window-options-editor.window-size-mode-options.label.fixed', 'Fixed'),
      value: WindowSizeMode.Fixed,
    },
  ];

  const updateWindowOptions = (v: WindowOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.WindowFunctions,
      window: v,
    });
  };

  const onWindowFieldChange = (v: SelectableValue<string>) => {
    updateWindowOptions({
      ...window!,
      field: v.value!,
    });
  };

  const onWindowSizeChange = (v?: number) => {
    updateWindowOptions({
      ...window!,
      windowSize: v && window?.windowSizeMode === WindowSizeMode.Percentage ? v / 100 : v,
    });
  };

  const onWindowSizeModeChange = (val: WindowSizeMode) => {
    updateWindowOptions({
      ...window!,
      windowSize: window?.windowSize
        ? val === WindowSizeMode.Percentage
          ? window!.windowSize! / 100
          : window!.windowSize! * 100
        : undefined,
      windowSizeMode: val,
    });
  };

  const onWindowStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    updateWindowOptions({ ...window, reducer });
  };

  const onTypeChange = (val: WindowAlignment) => {
    updateWindowOptions({
      ...window!,
      windowAlignment: val,
    });
  };

  return (
    <>
      <InlineField label={t('transformers.window-options-editor.label-field', 'Field')} labelWidth={LABEL_WIDTH}>
        <Select
          placeholder={t('transformers.window-options-editor.placeholder-field', 'Field')}
          options={selectOptions}
          className="min-width-18"
          value={window?.field}
          onChange={onWindowFieldChange}
        />
      </InlineField>
      <InlineField
        label={t('transformers.window-options-editor.label-calculation', 'Calculation')}
        labelWidth={LABEL_WIDTH}
      >
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[window?.reducer || ReducerID.mean]}
          onChange={onWindowStatsChange}
          defaultStat={ReducerID.mean}
          filterOptions={(ext) =>
            ext.id === ReducerID.mean || ext.id === ReducerID.variance || ext.id === ReducerID.stdDev
          }
        />
      </InlineField>
      <InlineField label={t('transformers.window-options-editor.label-type', 'Type')} labelWidth={LABEL_WIDTH}>
        <RadioButtonGroup
          value={window?.windowAlignment ?? WindowAlignment.Trailing}
          options={typeOptions}
          onChange={onTypeChange}
        />
      </InlineField>
      <InlineField
        label={t('transformers.window-options-editor.label-window-size-mode', 'Window size mode')}
        labelWidth={LABEL_WIDTH}
      >
        <RadioButtonGroup
          value={window?.windowSizeMode ?? WindowSizeMode.Percentage}
          options={windowSizeModeOptions}
          onChange={onWindowSizeModeChange}
        ></RadioButtonGroup>
      </InlineField>
      <InlineField
        label={
          window?.windowSizeMode === WindowSizeMode.Percentage
            ? t('transformers.window-options-editor.label-window-size-percent', 'Window size %')
            : t('transformers.window-options-editor.label-window-size', 'Window size')
        }
        labelWidth={LABEL_WIDTH}
        tooltip={
          window?.windowSizeMode === WindowSizeMode.Percentage
            ? t(
                'transformers.window-options-editor.tooltip-window-size-percent',
                'Set the window size as a percentage of the total data'
              )
            : t('transformers.window-options-editor.tooltip-window-size', 'Window size')
        }
      >
        <NumberInput
          placeholder={t('transformers.window-options-editor.placeholder-auto', 'Auto')}
          min={0.1}
          value={
            window?.windowSize && window.windowSizeMode === WindowSizeMode.Percentage
              ? window.windowSize * 100
              : window?.windowSize
          }
          onChange={onWindowSizeChange}
        ></NumberInput>
      </InlineField>
    </>
  );
};
