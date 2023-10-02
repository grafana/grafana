import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { CellMinMaxMode, TableCellBackgroundDisplayMode, TableColoredBackgroundCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

import { minMaxModes } from './utils';

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

  const onMinMaxModeChange = (v: CellMinMaxMode) => {
    cellOptions.minMaxMode = v;
    onChange(cellOptions);
  };

  return (
    <Stack direction="column" gap={0}>
      <Field label="Background display mode">
        <RadioButtonGroup
          value={cellOptions?.mode ?? TableCellBackgroundDisplayMode.Gradient}
          onChange={onCellOptionsChange}
          options={colorBackgroundOpts}
        />
      </Field>
      <Field label="Min/max">
        <RadioButtonGroup
          value={cellOptions?.minMaxMode ?? CellMinMaxMode.Field}
          onChange={onMinMaxModeChange}
          options={minMaxModes}
        />
      </Field>
    </Stack>
  );
};
