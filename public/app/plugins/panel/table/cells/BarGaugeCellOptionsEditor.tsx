import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/schema';
import { Field, HorizontalGroup, Select } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

export const BarGaugeCellOptionsEditor: React.FC<TableCellEditorProps> = (props) => {
  const onChange = () => {};

  return (
    <HorizontalGroup>
      <Field label="Gauge Display Mode">
        <Select onChange={onChange} options={barGaugeOpts} />
      </Field>
    </HorizontalGroup>
  );
};
