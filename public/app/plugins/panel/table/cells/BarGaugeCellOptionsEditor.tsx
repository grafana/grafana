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

export const BarGaugeCellOptionsEditor: React.FC<TableCellEditorProps> = ({ subOptions, onSubOptionsChange }) => {
  const onChange = (v: SelectableValue) => {
    if (subOptions === undefined) {
      subOptions = {};
    }

    subOptions.displayMode = v.value;
    onSubOptionsChange(subOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Gauge Display Mode">
        <Select value={subOptions?.displayMode} onChange={onChange} options={barGaugeOpts} />
      </Field>
    </HorizontalGroup>
  );
};
