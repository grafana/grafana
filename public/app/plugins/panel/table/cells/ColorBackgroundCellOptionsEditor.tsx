import React from 'react';

import { SelectableValue } from '@grafana/data';
import {
  TableCellDisplayMode,
  TableCellBackgroundDisplayMode,
  TableColoredBackgroundCellOptions,
} from '@grafana/schema';
import { HorizontalGroup, Select, Field } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const colorBackgroundOpts: SelectableValue[] = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColoredBackgroundCellOptions>) => {
  // When the select changes we build an options
  // object as needed and set the display mode
  const onCellOptionsChange = (v: SelectableValue) => {
    cellOptions.mode = v.value;
    onChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select value={cellOptions?.mode} onChange={onCellOptionsChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
