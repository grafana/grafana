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

interface ColorBackgroundEditorProps extends TableCellEditorProps {
  cellOptions?: TableColoredBackgroundCellOptions;
}

export const ColorBackgroundCellOptionsEditor: React.FC<ColorBackgroundEditorProps> = ({
  cellOptions,
  onCellOptionsChange,
}) => {
  // When the select changes we build an options
  // object as needed and set the display mode
  const onChange = (v: SelectableValue) => {
    if (cellOptions === undefined) {
      cellOptions = {
        type: TableCellDisplayMode.ColorBackground,
        mode: v.value,
      };
    } else {
      cellOptions.mode = v.value;
    }

    onCellOptionsChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select value={cellOptions?.mode} onChange={onChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
