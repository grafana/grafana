import React from 'react';

import { SelectableValue } from '@grafana/data';
import { TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Select, Field } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorBackgroundOpts: SelectableValue[] = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  // Set the display mode on change
  const onCellOptionsChange = (v: SelectableValue) => {
    cellOptions.mode = v.value;
    onChange(cellOptions);
  };

  return (
    <Field label="Background display mode">
      <Select value={cellOptions?.mode} onChange={onCellOptionsChange} options={colorBackgroundOpts} />
    </Field>
  );
};
