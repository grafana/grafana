import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode, TableBarGaugeCellOptions, TableCellDisplayMode } from '@grafana/schema';
import { Field, HorizontalGroup, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

// Explicity set the options we expect
interface BarGaugeEditorProps extends TableCellEditorProps {
  cellOptions?: TableBarGaugeCellOptions;
}

export const BarGaugeCellOptionsEditor: React.FC<BarGaugeEditorProps> = ({ cellOptions, onCellOptionsChange }) => {
  const onChange = (v: SelectableValue) => {
    if (cellOptions === undefined) {
      cellOptions = {
        type: TableCellDisplayMode.Gauge,
        mode: v.value,
      };
    } else {
      cellOptions.mode = v.value;
    }

    onCellOptionsChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Gauge Display Mode">
        <Select value={cellOptions?.mode} onChange={onChange} options={barGaugeOpts} />
      </Field>
    </HorizontalGroup>
  );
};
