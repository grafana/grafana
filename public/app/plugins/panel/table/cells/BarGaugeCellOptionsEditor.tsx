import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode, TableBarGaugeCellOptions } from '@grafana/schema';
import { Field, HorizontalGroup, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

export const BarGaugeCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableBarGaugeCellOptions>) => {
  // Set the display mode on change
  const onCellOptionsChange = (v: SelectableValue) => {
    cellOptions.mode = v.value;
    onChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Gauge Display Mode">
        <Select value={cellOptions?.mode} onChange={onCellOptionsChange} options={barGaugeOpts} />
      </Field>
    </HorizontalGroup>
  );
};
