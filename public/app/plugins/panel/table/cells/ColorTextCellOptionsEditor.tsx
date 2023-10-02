import React from 'react';

import { Stack } from '@grafana/experimental';
import { CellMinMaxMode, TableColorTextCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

import { minMaxModes } from './utils';

export const ColorTextCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableColorTextCellOptions>) => {
  const onMinMaxModeChange = (v: CellMinMaxMode) => {
    cellOptions.minMaxMode = v;
    onChange(cellOptions);
  };

  return (
    <Stack direction="column" gap={0}>
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
