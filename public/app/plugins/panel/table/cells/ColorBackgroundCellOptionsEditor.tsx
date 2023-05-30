import React from 'react';

import { SelectableValue } from '@grafana/data';
import { TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

const colorBackgroundOpts: Array<SelectableValue<TableCellBackgroundDisplayMode>> = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  // Set the display mode on change
  const onCellOptionsChange = (v: TableCellBackgroundDisplayMode) => {
    cellOptions.mode = v;
    onChange(cellOptions);
  };

  return (
    <Field label="Background display mode">
      <RadioButtonGroup
        value={cellOptions?.mode ?? TableCellBackgroundDisplayMode.Gradient}
        onChange={onCellOptionsChange}
        options={colorBackgroundOpts}
      />
    </Field>
  );
};
