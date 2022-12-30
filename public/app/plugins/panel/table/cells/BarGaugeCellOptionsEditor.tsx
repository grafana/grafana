import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode, TableGaugeCellOptions, TableCellDisplayMode } from '@grafana/schema';
import { Field, HorizontalGroup, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

// Explicity set the options we expect
interface BarGaugeEditorProps extends TableCellEditorProps {
  cellOptions?: TableGaugeCellOptions;
}

export const BarGaugeCellOptionsEditor: React.FC<BarGaugeEditorProps> = ({ cellOptions, onCellOptionsChange }) => {
  const onChange = (v: SelectableValue) => {
    if (cellOptions === undefined) {
      cellOptions = {
        displayMode: TableCellDisplayMode.Gauge,
        gaugeDisplayMode: v.value,
      };
    } else {
      cellOptions.gaugeDisplayMode = v.value;
    }

    onCellOptionsChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Gauge Display Mode">
        <Select value={cellOptions?.gaugeDisplayMode} onChange={onChange} options={barGaugeOpts} />
      </Field>
    </HorizontalGroup>
  );
};
