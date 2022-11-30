import React from 'react';

import { SelectableValue } from '@grafana/data';
import { BackgroundDisplayMode, TableCellSubOptions } from '@grafana/schema';
import { HorizontalGroup, Select, Field } from '@grafana/ui';

import { TableCellEditorProps } from '../models.gen';

const colorBackgroundOpts: SelectableValue[] = [
  { value: BackgroundDisplayMode.Basic, label: 'Basic' },
  { value: BackgroundDisplayMode.Gradient, label: 'Gradient' },
];

export const ColorBackgroundCellOptionsEditor: React.FC<TableCellEditorProps> = (props) => {
  const onChange = () => {};

  return (
    <HorizontalGroup>
      <Field label="Background display mode">
        <Select onChange={onChange} options={colorBackgroundOpts} />
      </Field>
    </HorizontalGroup>
  );
};
