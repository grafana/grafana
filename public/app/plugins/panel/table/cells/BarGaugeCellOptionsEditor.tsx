import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableBarGaugeCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

type Props = TableCellEditorProps<TableBarGaugeCellOptions>;

export const BarGaugeCellOptionsEditor = ({ cellOptions, onChange }: Props) => (
  <>
    <Field noMargin label={t('table.bar-gauge-cell-options-editor.label-gauge-display-mode', 'Gauge display mode')}>
      <RadioButtonGroup<BarGaugeDisplayMode>
        value={cellOptions?.mode ?? BarGaugeDisplayMode.Gradient}
        onChange={(v) => {
          cellOptions.mode = v;
          onChange(cellOptions);
        }}
        options={barGaugeOpts}
      />
    </Field>
    <Field noMargin label={t('table.bar-gauge-cell-options-editor.label-value-display', 'Value display')}>
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
