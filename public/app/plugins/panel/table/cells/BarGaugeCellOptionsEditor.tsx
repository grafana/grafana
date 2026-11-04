import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeValueMode, type TableBarGaugeCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';
import { CellOptionSearchLabel } from './CellOptionSearchLabel';

type Props = TableCellEditorProps<TableBarGaugeCellOptions>;
export const barGaugeCellOptionLabels = {
  displayMode: t('table.bar-gauge-cell-options-editor.label-gauge-display-mode', 'Gauge display mode'),
  valueDisplay: t('table.bar-gauge-cell-options-editor.label-value-display', 'Value display'),
};

export const BarGaugeCellOptionsEditor = ({ cellOptions, onChange, searchQuery }: Props) => (
  <>
    <Field
      noMargin
      label={<CellOptionSearchLabel label={barGaugeCellOptionLabels.displayMode} searchQuery={searchQuery} />}
    >
      <RadioButtonGroup<BarGaugeDisplayMode>
        value={cellOptions?.mode ?? BarGaugeDisplayMode.Gradient}
        onChange={(v) => {
          cellOptions.mode = v;
          onChange(cellOptions);
        }}
        options={barGaugeOpts}
      />
    </Field>
    <Field
      noMargin
      label={<CellOptionSearchLabel label={barGaugeCellOptionLabels.valueDisplay} searchQuery={searchQuery} />}
    >
      <RadioButtonGroup<BarGaugeValueMode>
        value={cellOptions?.valueDisplayMode ?? BarGaugeValueMode.Text}
        onChange={(v) => {
          cellOptions.valueDisplayMode = v;
          onChange(cellOptions);
        }}
        options={valueModes}
      />
    </Field>
  </>
);

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

const valueModes: SelectableValue[] = [
  { value: BarGaugeValueMode.Color, label: 'Value color' },
  { value: BarGaugeValueMode.Text, label: 'Text color' },
  { value: BarGaugeValueMode.Hidden, label: 'Hidden' },
];
