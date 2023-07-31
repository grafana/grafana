import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableBarGaugeCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

type Props = TableCellEditorProps<TableBarGaugeCellOptions>;

export function BarGaugeCellOptionsEditor({ cellOptions, onChange }: Props) {
  // Set the display mode on change
  const onCellOptionsChange = (v: BarGaugeDisplayMode) => {
    cellOptions.mode = v;
    onChange(cellOptions);
  };

  const onValueModeChange = (v: BarGaugeValueMode) => {
    cellOptions.valueDisplayMode = v;
    onChange(cellOptions);
  };

  return (
    <Stack direction="column" gap={0}>
      <Field label="Gauge display mode">
        <RadioButtonGroup
          value={cellOptions?.mode ?? BarGaugeDisplayMode.Gradient}
          onChange={onCellOptionsChange}
          options={barGaugeOpts}
        />
      </Field>
      <Field label="Value display">
        <RadioButtonGroup
          value={cellOptions?.valueDisplayMode ?? BarGaugeValueMode.Text}
          onChange={onValueModeChange}
          options={valueModes}
        />
      </Field>
    </Stack>
  );
}

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
