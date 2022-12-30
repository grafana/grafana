import React from 'react';

import { SelectableValue } from '@grafana/data';
import { TableCellDisplayMode, TableCellBackgroundDisplayMode, TableColorBackgroundCellOptions } from '@grafana/schema';
import { HorizontalGroup, Select, Field } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const colorBackgroundOpts: SelectableValue[] = [
  { value: TableCellBackgroundDisplayMode.Basic, label: 'Basic' },
  { value: TableCellBackgroundDisplayMode.Gradient, label: 'Gradient' },
];

interface ColorBackgroundEditorProps extends TableCellEditorProps {
  cellOptions?: TableColorBackgroundCellOptions;
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
        displayMode: TableCellDisplayMode.ColorBackground,
        backgroundDisplayMode: v.value,
      };
    } else {
      cellOptions.backgroundDisplayMode = v.value;
    }

    onCellOptionsChange(cellOptions);
  };

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select value={cellOptions?.backgroundDisplayMode} onChange={onChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
