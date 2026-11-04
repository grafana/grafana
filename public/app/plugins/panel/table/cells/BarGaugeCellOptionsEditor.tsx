import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode, BarGaugeValueMode, type TableBarGaugeCellOptions } from '@grafana/schema';
import { RadioButtonGroup } from '@grafana/ui';

import {
  type TableCellOptionEditorDefinition,
  type TableCellOptionEditorProps,
  renderCellOptionEditors,
} from './TableCellOptionEditorRegistry';

type Props = TableCellOptionEditorProps<TableBarGaugeCellOptions>;

const BarGaugeDisplayModeEditor = ({ cellOptions, onChange }: Props) => (
  <RadioButtonGroup<BarGaugeDisplayMode>
    value={cellOptions?.mode ?? BarGaugeDisplayMode.Gradient}
    onChange={(v) => {
      cellOptions.mode = v;
      onChange(cellOptions);
    }}
    options={barGaugeOpts}
  />
);

const BarGaugeValueDisplayEditor = ({ cellOptions, onChange }: Props) => (
  <RadioButtonGroup<BarGaugeValueMode>
    value={cellOptions?.valueDisplayMode ?? BarGaugeValueMode.Text}
    onChange={(v) => {
      cellOptions.valueDisplayMode = v;
      onChange(cellOptions);
    }}
    options={valueModes}
  />
);

export const barGaugeCellOptionEditors: Array<TableCellOptionEditorDefinition<TableBarGaugeCellOptions>> = [
  {
    id: 'mode',
    name: () => t('table.bar-gauge-cell-options-editor.label-gauge-display-mode', 'Gauge display mode'),
    Editor: BarGaugeDisplayModeEditor,
  },
  {
    id: 'valueDisplayMode',
    name: () => t('table.bar-gauge-cell-options-editor.label-value-display', 'Value display'),
    Editor: BarGaugeValueDisplayEditor,
  },
];

export const BarGaugeCellOptionsEditor = (props: Props) => renderCellOptionEditors(barGaugeCellOptionEditors, props);

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
